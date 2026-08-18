'use strict';
const express = require('express');
const { requireEitherStaffAuth } = require('../middleware/staffAuth');
const { toTechnicianAppProfile } = require('../services/technicians');
const { toResponseAppProfile } = require('../services/responseOfficers');

const router = express.Router();
router.use(requireEitherStaffAuth);

router.get('/', (req, res) => {
  const profile = req.staffType === 'technician'
    ? toTechnicianAppProfile(req.staff)
    : toResponseAppProfile(req.staff);
  res.json({ ...profile, staffType: req.staffType });
});

// PATCH /api/app/staff-me/push-token — registers (or clears, with token:null
// on sign-out) this device's Expo push token against whichever staff record
// this session is linked to.
async function pushTokenHandler(req, res) {
  const { token } = req.body || {};
  if (token !== null && typeof token !== 'string') {
    return res.status(400).json({ error: 'token must be a string or null' });
  }
  try {
    req.staff.expoPushToken = token;
    await req.staff.save();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.patch('/push-token', pushTokenHandler);

module.exports = router;
module.exports.pushTokenHandler = pushTokenHandler;
