'use strict';
const express         = require('express');
const fetch           = require('node-fetch');
const Camera          = require('../models/Camera');
const { requireAuth } = require('../middleware/auth');
const { friendlySaveError } = require('../utils/mongoErrors');
const { encryptCredentials } = require('../services/deviceCredentials');
const dahua           = require('../services/dahua');

const router = express.Router();
router.use(requireAuth);

const CAMERA_STATUSES = ['online', 'offline'];

// GET /api/cameras?clientId=<id>
router.get('/', async (req, res) => {
  try {
    const { clientId } = req.query;
    const filter = { archived: false };
    if (clientId) filter.clientRef = clientId;
    const cameras = await Camera.find(filter).sort({ name: 1 }).populate('clientRef', 'name');
    res.json(cameras);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/cameras/:id
router.get('/:id', async (req, res) => {
  try {
    const camera = await Camera.findById(req.params.id).populate('clientRef', 'name');
    if (!camera || camera.archived) return res.status(404).json({ error: 'Not found' });
    res.json(camera);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cameras
async function createHandler(req, res) {
  try {
    const camera = await Camera.create(req.body);
    // Camera.create() returns the full in-memory document, bypassing the
    // select:false on credentials/streamConfig that every query-based route
    // (GET/PUT) already gets for free — strip them explicitly here too.
    camera.credentials = undefined;
    camera.streamConfig = undefined;
    res.status(201).json(camera);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'camera') });
  }
}
router.post('/', createHandler);

// PUT /api/cameras/:id
async function updateHandler(req, res) {
  try {
    const camera = await Camera.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!camera) return res.status(404).json({ error: 'Not found' });
    res.json(camera);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'camera') });
  }
}
router.put('/:id', updateHandler);

// PATCH /api/cameras/:id/status
router.patch('/:id/status', async (req, res) => {
  const { status, signal } = req.body;
  if (status && !CAMERA_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const updates = {};
    if (status) updates.status = status;
    if (signal) updates.signal = signal;
    const camera = await Camera.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!camera) return res.status(404).json({ error: 'Not found' });
    res.json(camera);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/cameras/:id/credentials — kept separate from the general PUT so
// credentials never round-trip through the general edit form's body, and so
// the UI can show a distinct "Credentials saved" confirmation. Never returns
// the plaintext or ciphertext back to the caller.
async function credentialsHandler(req, res) {
  try {
    const camera = await Camera.findById(req.params.id);
    if (!camera || camera.archived) return res.status(404).json({ error: 'Not found' });

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are both required.' });
    }

    camera.credentials = encryptCredentials({ username, password });
    if (!camera.streamProvider && camera.deviceSerial) camera.streamProvider = 'dahua';
    await camera.save();
    res.json({ ok: true, streamProvider: camera.streamProvider });
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'camera') });
  }
}
router.patch('/:id/credentials', credentialsHandler);

// GET /api/cameras/:id/channels — discovers an NVR/DVR's individual channels
// via Dahua so the admin can pick which ones to import as their own Camera
// row. `camera` here is the device-level row (deviceSerial set, channelId
// null) — a plain single IPC row would just come back with one channel.
async function listChannelsHandler(req, res) {
  try {
    const camera = await Camera.findById(req.params.id);
    if (!camera || camera.archived) return res.status(404).json({ error: 'Not found' });
    if (!camera.deviceSerial) {
      return res.status(400).json({ error: 'This camera has no device serial to look up channels for.' });
    }

    let details;
    try {
      details = await dahua.listDeviceDetails(camera.deviceSerial);
    } catch (err) {
      console.error('[cameras] listDeviceDetails failed:', err.message);
      return res.status(502).json({ error: 'Dahua could not be reached to list this device\'s channels. Try again shortly.' });
    }

    const existing = await Camera.find({ deviceSerial: camera.deviceSerial }, 'channelId');
    const importedChannelIds = new Set(existing.map(c => c.channelId).filter(id => id !== null));

    res.json({
      deviceModel: details.deviceModel,
      catalog: details.catalog,
      channels: details.channels.map(ch => ({
        ...ch,
        alreadyImported: importedChannelIds.has(ch.channelId),
      })),
    });
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'camera') });
  }
}
router.get('/:id/channels', listChannelsHandler);

// POST /api/cameras/:id/channels/import — creates one Camera row per selected
// channel, sharing the parent device row's clientRef/location/deviceSerial.
// The device-level row (channelId null) is left untouched — it stays the
// target for whole-device online/offline events, which is why it's never
// deleted or converted here.
async function importChannelsHandler(req, res) {
  try {
    const parent = await Camera.findById(req.params.id);
    if (!parent || parent.archived) return res.status(404).json({ error: 'Not found' });
    if (!parent.deviceSerial) {
      return res.status(400).json({ error: 'This camera has no device serial to import channels for.' });
    }

    const requested = Array.isArray(req.body?.channels) ? req.body.channels : [];
    if (!requested.length) {
      return res.status(400).json({ error: 'Choose at least one channel to import.' });
    }

    const existing = await Camera.find({ deviceSerial: parent.deviceSerial }, 'channelId');
    const alreadyImported = new Set(existing.map(c => c.channelId).filter(id => id !== null));

    // Re-fetch each channel's real status from Dahua rather than trust
    // whatever the client saw when the picker was opened (it may be stale by
    // the time Import is clicked) or default silently to the schema's
    // 'offline' default — a freshly-imported online channel must not read
    // as offline just because nobody's set it manually yet. A Dahua failure
    // here must not block the import itself; it just falls back to 'offline'
    // until the next real online/offline push corrects it.
    let statusByChannelId = new Map();
    try {
      const details = await dahua.listDeviceDetails(parent.deviceSerial);
      statusByChannelId = new Map(details.channels.map(ch => [ch.channelId, ch.status]));
    } catch (err) {
      console.error('[cameras] listDeviceDetails failed during import, defaulting new channels to offline:', err.message);
    }

    const created = [];
    for (const ch of requested) {
      const channelId = Number(ch.channelId);
      if (!Number.isFinite(channelId) || alreadyImported.has(channelId)) continue;

      const camera = await Camera.create({
        clientRef: parent.clientRef,
        name: ch.name || `Channel ${channelId}`,
        location: parent.location,
        deviceSerial: parent.deviceSerial,
        channelId,
        status: statusByChannelId.get(channelId) || 'offline',
        streamProvider: 'dahua',
      });
      camera.credentials = undefined;
      camera.streamConfig = undefined;
      created.push(camera);
      alreadyImported.add(channelId);
    }

    res.json({ created });
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'camera') });
  }
}
router.post('/:id/channels/import', importChannelsHandler);

// GET /api/cameras/:id/live — resolves whether/how this camera can be
// live-viewed right now. Mirrors appCameras.js's streamHandler contract
// (kept as two separate handlers rather than a shared one since admin and
// app auth/routing differ, but the response shape matches on purpose):
//   { hasLiveView: false }                              — no live view configured (normal)
//   { hasLiveView: true, available: false, reason }      — configured but unavailable (503)
//   { hasLiveView: true, available: true, ...session }   — ready
async function liveViewHandler(req, res) {
  try {
    const camera = await Camera.findById(req.params.id);
    if (!camera || camera.archived) return res.status(404).json({ error: 'Not found' });
    if (!camera.streamProvider) return res.json({ hasLiveView: false });

    const session = await dahua.getLiveViewSession(camera);
    if (session.status === 'not_configured') return res.json({ hasLiveView: false });
    if (session.status === 'unavailable') {
      return res.status(503).json({ hasLiveView: true, available: false, reason: session.reason, error: session.reason });
    }
    const { status, ...payload } = session;
    res.json({ hasLiveView: true, available: true, ...payload });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.get('/:id/live', liveViewHandler);

// GET /api/cameras/:id/live-stream — real streaming live view: returns a
// short-lived (~10s validity) RTSP-over-websocket URL for the Dahua
// plugin-free web player. Same three-outcome contract as /live; the caller
// must feed the URL to the player immediately, so this is fetched at
// play-time, never ahead of it. The /live snapshot route stays as the
// fallback surface when streaming is unavailable.
async function liveStreamHandler(req, res) {
  try {
    const camera = await Camera.findById(req.params.id);
    if (!camera || camera.archived) return res.status(404).json({ error: 'Not found' });
    if (!camera.streamProvider) return res.json({ hasLiveView: false });

    const session = await dahua.getLiveStreamSession(camera);
    if (session.status === 'not_configured') return res.json({ hasLiveView: false });
    if (session.status === 'unavailable') {
      return res.status(503).json({ hasLiveView: true, available: false, reason: session.reason, error: session.reason });
    }
    const { status, ...payload } = session;
    res.json({ hasLiveView: true, available: true, ...payload });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.get('/:id/live-stream', liveStreamHandler);

// GET /api/cameras/:id/live/image — proxies the actual snapshot bytes,
// rather than handing the client Dahua's raw signed Aliyun OSS URL
// directly. Needed because that OSS object's Content-Type comes back as
// application/octet-stream, not image/jpeg (Dahua's own upload doesn't set
// it) — confirmed live 2026-08-03 (see BUGS_AND_FIXES.md): a browser <img>
// pointed straight at it refuses to render, and even direct navigation
// downloads it as a generic file instead of displaying it. Re-serving the
// bytes ourselves with an explicit Content-Type sidesteps that regardless
// of what Dahua's storage sends. Same not_configured/unavailable/ready
// branching as liveViewHandler, just expressed as HTTP status + binary body
// instead of JSON, since the caller here wants bytes, not a status object.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Dahua's snapshot API hands back the OSS URL immediately, but the actual
// upload to that path happens asynchronously on their end — fetching it the
// instant it's returned can beat the upload and 404 (confirmed live
// 2026-08-03, see BUGS_AND_FIXES.md: curl succeeded consistently a few
// seconds after the URL was issued, but the proxy's immediate fetch kept
// 404ing). A short retry-with-backoff covers that race without blindly
// delaying every request by a fixed amount.
const SNAPSHOT_FETCH_RETRIES = 3;
const SNAPSHOT_FETCH_RETRY_DELAY_MS = 400;

async function fetchSnapshotWithRetry(url) {
  let lastStatus;
  for (let attempt = 0; attempt < SNAPSHOT_FETCH_RETRIES; attempt++) {
    if (attempt > 0) await sleep(SNAPSHOT_FETCH_RETRY_DELAY_MS);
    const imgRes = await fetch(url);
    if (imgRes.ok) return imgRes;
    lastStatus = imgRes.status;
  }
  throw new Error(`OSS returned ${lastStatus} after ${SNAPSHOT_FETCH_RETRIES} attempts`);
}

async function liveViewImageHandler(req, res) {
  try {
    const camera = await Camera.findById(req.params.id);
    if (!camera || camera.archived) return res.status(404).json({ error: 'Not found' });

    const session = await dahua.getLiveViewSession(camera);
    if (session.status === 'not_configured') {
      return res.status(404).json({ error: 'Live view is not set up for this camera.' });
    }
    if (session.status === 'unavailable') {
      return res.status(503).json({ error: session.reason });
    }

    let imgRes;
    try {
      imgRes = await fetchSnapshotWithRetry(session.url);
    } catch (err) {
      console.error('[cameras] snapshot image fetch failed:', err.message);
      return res.status(502).json({ error: 'Could not retrieve the snapshot image. Try again shortly.' });
    }
    const buffer = await imgRes.buffer();
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    console.error('[cameras] liveViewImageHandler failed:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}
router.get('/:id/live/image', liveViewImageHandler);

// DELETE /api/cameras/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    const camera = await Camera.findByIdAndUpdate(req.params.id, { archived: true }, { new: true });
    if (!camera) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.createHandler = createHandler;
module.exports.updateHandler = updateHandler;
module.exports.credentialsHandler = credentialsHandler;
module.exports.listChannelsHandler = listChannelsHandler;
module.exports.importChannelsHandler = importChannelsHandler;
module.exports.liveViewHandler = liveViewHandler;
module.exports.liveStreamHandler = liveStreamHandler;
module.exports.liveViewImageHandler = liveViewImageHandler;
