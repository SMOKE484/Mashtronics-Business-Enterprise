'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Client = require('../models/Client');
const Technician = require('../models/Technician');
const ResponseOfficer = require('../models/ResponseOfficer');

// One-off: supabaseUserId used to have `default: null`, which stores a
// literal null on every unlinked record. A sparse unique index still
// indexes a present-but-null field, so the second unlinked record in any
// of these collections collides with the first (E11000). The model no
// longer sets that default; this unsets the stale literal nulls already
// in the DB so existing unlinked records become genuinely sparse too.
// Run once after deploying the model fix.
async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const [label, Model] of [['clients', Client], ['technicians', Technician], ['response officers', ResponseOfficer]]) {
    const result = await Model.updateMany({ supabaseUserId: null }, { $unset: { supabaseUserId: '' } });
    console.log(`${label}: unset supabaseUserId on ${result.modifiedCount} record(s)`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
