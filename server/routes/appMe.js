'use strict';
const express               = require('express');
const { requireClientAuth } = require('../middleware/clientAuth');
const { toAppProfile }      = require('../services/clients');

const router = express.Router();
router.use(requireClientAuth);

// GET /api/app/me
router.get('/', (req, res) => {
  res.json(toAppProfile(req.client));
});

module.exports = router;
