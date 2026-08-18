'use strict';
const express               = require('express');
const Camera                = require('../models/Camera');
const { requireClientAuth } = require('../middleware/clientAuth');
const { toAppCamera }       = require('../services/cameras');
const dahua                 = require('../services/dahua');

const router = express.Router();
router.use(requireClientAuth);

// GET /api/app/cameras
router.get('/', async (req, res) => {
  try {
    const cameras = await Camera.find({ clientRef: req.client._id, archived: false }).sort({ name: 1 });
    res.json(cameras.map(toAppCamera));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/app/cameras/:id
router.get('/:id', async (req, res) => {
  try {
    const camera = await Camera.findOne({ _id: req.params.id, clientRef: req.client._id, archived: false });
    if (!camera) return res.status(404).json({ error: 'Not found' });
    res.json(toAppCamera(camera));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/app/cameras/:id/stream — resolves whether/how this camera can be
// live-viewed right now. Three distinguishable outcomes so the mobile client
// can tell "not set up" from "temporarily broken" without string-matching:
//   { hasLiveView: false }                              — no live view configured (normal)
//   { hasLiveView: true, available: false, reason }      — configured but unavailable (503)
//   { hasLiveView: true, available: true, ...session }   — ready (Phase B only)
async function streamHandler(req, res) {
  try {
    const camera = await Camera.findOne({ _id: req.params.id, clientRef: req.client._id, archived: false })
      .select('+credentials');
    if (!camera) return res.status(404).json({ error: 'Not found' });
    if (!camera.streamProvider) return res.json({ hasLiveView: false });

    const session = await dahua.getLiveViewSession(camera);
    if (session.status === 'not_configured') return res.json({ hasLiveView: false });
    if (session.status === 'unavailable') {
      // `error` is included alongside `reason` so the mobile api() client's
      // generic non-2xx error extraction (which only reads `.error`) still
      // surfaces a human message — see useCameraStream.js.
      return res.status(503).json({ hasLiveView: true, available: false, reason: session.reason, error: session.reason });
    }
    const { status, ...payload } = session;
    res.json({ hasLiveView: true, available: true, ...payload });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.get('/:id/stream', streamHandler);

// GET /api/app/cameras/:id/live-stream — real streaming live view for the
// mobile app's player WebView. Mirrors the admin /cameras/:id/live-stream
// contract exactly; the returned RTSP URL is only connectable for ~10s, so
// the app must hand it to the player immediately. The snapshot-based
// /stream route above stays untouched as the fallback surface.
async function liveStreamHandler(req, res) {
  try {
    const camera = await Camera.findOne({ _id: req.params.id, clientRef: req.client._id, archived: false });
    if (!camera) return res.status(404).json({ error: 'Not found' });
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

module.exports = router;
module.exports.streamHandler = streamHandler;
module.exports.liveStreamHandler = liveStreamHandler;
