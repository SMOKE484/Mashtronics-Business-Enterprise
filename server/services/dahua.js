'use strict';
const fetch     = require('node-fetch');
const dahuaAuth = require('./dahuaAuth');

// getLiveViewSession/getSnapshotUrl below are real as of 2026-08-03, built
// on the Open ARC track (not Open IOT — see HANDOFF.md's "live-view
// architecture decided" entry for why: Open IOT's device-add is an
// exclusive claim that would break the DMSS multi-user sharing every real
// customer install already depends on). "Live view" for this phase is a
// repeated snapshot (caller polls on a ~5s interval), not true streaming
// video — Open ARC's createDeviceStreamUrl only returns a raw RTSP URL that
// no browser plays natively, and a self-hosted RTSP->HLS relay was
// deliberately ruled out (real ongoing infra/bandwidth cost, not worth it
// for this phase — see HANDOFF.md). getPlaybackSession is still scaffold —
// recorded playback is roadmap, not this phase. Every function's result is
// one of three fixed shapes, unchanged since Phase A so callers (routes,
// mobile) never need to change:
//   { status: 'not_configured' }        — no provider/serial/channel set
//   { status: 'unavailable', reason }   — configured, but the Dahua call failed
//   { status: 'ready', ...payload }     — a real, usable result
//
// ackMessage/setActivationStatus below ARE real — proven live in the
// 2026-08-01 session and needed by the callback route (server/routes/
// dahuaCallback.js) and the pending-bind resolve flow (server/routes/
// dahuaPendingBinds.js).

// Only a per-channel imported row (channelId set) is individually
// streamable — a device-level row (channelId: null) represents the whole
// NVR, not one feed. credentials are deliberately NOT required here: Open
// ARC's createDeviceStreamUrl/setDeviceSnapEnhanced authenticate via the
// ARC company's UserAccessToken (dahuaAuth.js), not a per-device login —
// the optional devCode field is only for password-protected/TCM devices,
// not the normal path.
function isConfigured(camera) {
  return camera.streamProvider === 'dahua' && !!camera.deviceSerial && camera.channelId != null;
}

// setDeviceSnapEnhanced hands back its OSS URL immediately, but the actual
// capture + upload happens asynchronously on Dahua's side — the URL 404s
// until the device's upload lands. Measured live 2026-08-04 against the real
// NVR (BD10A23PAJF6096): 3.6–5.7s across three online channels, so the
// budget sits comfortably above the worst measured case. Both surfaces
// (admin /live + mobile /stream) consume getSnapshotUrl, so verifying here —
// before ever reporting 'ready' — fixes the race for every caller at once;
// callers can trust that a returned URL is actually fetchable.
//
// Probe with a 1-byte Range GET, not HEAD: OSS pre-signed URLs sign the HTTP
// verb, so a HEAD against a GET-signed URL is rejected outright.
const SNAPSHOT_READY_TIMEOUT_MS = 10_000;
const SNAPSHOT_READY_POLL_MS    = 700;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForSnapshotReady(url) {
  const deadline = Date.now() + SNAPSHOT_READY_TIMEOUT_MS;
  for (;;) {
    try {
      const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
      await res.buffer().catch(() => {});
      if (res.ok) return true;
    } catch { /* transient network error — keep polling until the deadline */ }
    if (Date.now() >= deadline) return false;
    await sleep(SNAPSHOT_READY_POLL_MS);
  }
}

async function getSnapshotUrl(camera) {
  if (!isConfigured(camera)) return { status: 'not_configured' };
  try {
    const data = await dahuaAuth.signedRequest(
      '/open-api/api-converter/device/setDeviceSnapEnhanced',
      { deviceId: camera.deviceSerial, channelId: String(camera.channelId) },
      { requireUserToken: true }
    );
    if (!await waitForSnapshotReady(data.url)) {
      console.error('[dahua] snapshot URL never became fetchable within budget:', data.url);
      return { status: 'unavailable', reason: 'Snapshot could not be captured. Try again shortly.' };
    }
    return { status: 'ready', url: data.url };
  } catch (err) {
    console.error('[dahua] setDeviceSnapEnhanced failed:', err.message);
    return { status: 'unavailable', reason: 'Snapshot could not be captured. Try again shortly.' };
  }
}

// "Live view" for this phase is exactly a fresh snapshot — the caller
// (admin/mobile) re-fetches on a ~5s interval to simulate live updates,
// which also naturally respects Dahua's documented >=3s rate limit between
// capture calls. Kept as its own exported function (rather than having
// callers call getSnapshotUrl directly) since the routes that use it are
// semantically asking "can I watch this camera", matching the shape
// mobile's /stream route and the admin /live route both already expect.
async function getLiveViewSession(camera) {
  return getSnapshotUrl(camera);
}

// Real streaming live view — createDeviceStreamUrl with businessType 'real'
// returns a cloud-relayed RTSP URL through Dahua's own proxy (proven live
// 2026-08-04 against the real NVR). The URL is only connectable for ~10
// seconds after issue (Video Play FAQ), so callers must hand it to the
// player immediately — never cache it. Playable ONLY by Dahua's plugin-free
// web player SDK (websocket + RTSP), not by <video>/VLC — see
// General_VideoPlayer_Web_Javascript_V1.3.6/.
//
// streamType 1 (sub stream) by default: the player is typically rendering
// in a modal/phone-sized window, and the sub stream is far lighter on the
// client's upload bandwidth than main-stream 4MP footage.
async function getLiveStreamSession(camera, { streamType = 1 } = {}) {
  if (!isConfigured(camera)) return { status: 'not_configured' };
  try {
    const data = await dahuaAuth.signedRequest(
      '/open-api/api-converter/device/createDeviceStreamUrl',
      {
        deviceId: camera.deviceSerial,
        channelId: Number(camera.channelId),
        businessType: 'real',
        encryptMode: 0,
        protoType: 'rtsp',
        streamType,
        deviceType: 'channel',
      },
      { requireUserToken: true }
    );
    if (!data?.url) throw new Error('Dahua returned no stream URL');
    return {
      status: 'ready',
      url: data.url,
      deviceId: camera.deviceSerial,
      channelId: String(camera.channelId),
      streamType,
    };
  } catch (err) {
    console.error('[dahua] createDeviceStreamUrl failed:', err.message);
    return { status: 'unavailable', reason: 'Live stream could not be started. Try again shortly.' };
  }
}

async function getPlaybackSession(camera, { start, end } = {}) {
  if (!isConfigured(camera)) return { status: 'not_configured' };
  return { status: 'unavailable', reason: 'Playback is not yet available for this camera.' };
}

// Tells Dahua's cloud a pushed event was received — without this call it
// keeps re-pushing the same event "at a certain frequency" (Event Message
// doc). Non-user-login business call (no UserAccessToken needed).
async function ackMessage(dahuaMessageId) {
  await dahuaAuth.signedRequest('/open-api/api-message/notice/messageAck', { id: dahuaMessageId });
}

// Required once per device after a bind, before any device API works
// (proven live 2026-08-01 — listDeviceDetailsByIds failed BIZ084 "Device not
// activated" until this was called). Needs the ARC company's UserAccessToken.
async function setActivationStatus(deviceIds, activationStatus) {
  await dahuaAuth.signedRequest(
    '/open-api/api-converter/device/setActivationStatus',
    { deviceIds, activationStatus },
    { requireUserToken: true }
  );
}

// Discovers an NVR/DVR's individual channels (name, id, status) so they can
// be imported as one Camera row each. Proven live 2026-08-01 against the real
// NVR (BD10A23PAJF6096) — returned 21 named channels. Requires activation
// (setActivationStatus) to have already succeeded for this device, same as
// every other per-device call. channelId/channelNum come back from Dahua as
// strings — cast to Number here, the single boundary point, so nothing
// downstream has to re-cast (matches Camera.channelId's Number schema type).
async function listDeviceDetails(deviceSerial) {
  const data = await dahuaAuth.signedRequest(
    '/open-api/api-converter/device/listDeviceDetailsByIds',
    { deviceList: [{ deviceId: deviceSerial }] },
    { requireUserToken: true }
  );
  const device = data?.deviceList?.[0];
  if (!device) throw new Error('Dahua returned no details for that device.');
  return {
    deviceModel: device.deviceModel || '',
    catalog: device.catalog || '',
    channels: (device.channels || []).map(ch => ({
      channelId: Number(ch.channelId),
      name: ch.channelName || `Channel ${ch.channelId}`,
      status: ch.channelStatus === 'online' ? 'online' : 'offline',
      ability: ch.channelAbility || '',
    })),
  };
}

module.exports = { getLiveViewSession, getLiveStreamSession, getSnapshotUrl, getPlaybackSession, ackMessage, setActivationStatus, listDeviceDetails };
