'use strict';
const express         = require('express');
const { requireAuth } = require('../middleware/auth');
const { addAdminClient, removeAdminClient } = require('../services/realtime');

const router = express.Router();
router.use(requireAuth);

// GET /api/events — live SSE stream for the admin dashboard (panic + chat updates)
router.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(': connected\n\n');

  addAdminClient(res);
  req.on('close', () => removeAdminClient(res));
});

module.exports = router;
