'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const ResponseOfficer = require('../models/ResponseOfficer');
const { linkStaffAuthorization } = require('../services/supabaseLinks');

// One-off backfill: any Technician/ResponseOfficer claimed BEFORE
// public.staff_links existed in Supabase never got a mapping row (claim-time
// linkStaffAuthorization didn't exist yet / silently failed). Run once after
// server/scripts/supabase-storage.sql has been applied.
async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const technicians = await Technician.find({ supabaseUserId: { $exists: true, $ne: null } });
  const officers = await ResponseOfficer.find({ supabaseUserId: { $exists: true, $ne: null } });
  console.log(`Found ${technicians.length} claimed technician(s), ${officers.length} claimed officer(s).`);

  for (const tech of technicians) {
    await linkStaffAuthorization(tech.supabaseUserId, String(tech._id), 'technician');
    console.log(`  linked technician ${tech.name || tech._id} (${tech.supabaseUserId})`);
  }
  for (const officer of officers) {
    await linkStaffAuthorization(officer.supabaseUserId, String(officer._id), 'response');
    console.log(`  linked officer ${officer.name || officer._id} (${officer.supabaseUserId})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
