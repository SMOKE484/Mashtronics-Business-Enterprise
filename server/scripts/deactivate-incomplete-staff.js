'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const ResponseOfficer = require('../models/ResponseOfficer');
const { missingFieldsForActive } = require('../services/staffActivation');

// One-off: technicians/response officers could previously be active with a
// blank phone, email, or role (the completeness rule didn't exist yet).
// Deactivates any already-active record that wouldn't pass the new rule.
async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const [label, Model] of [['technicians', Technician], ['response officers', ResponseOfficer]]) {
    const active = await Model.find({ active: true });
    const incomplete = active.filter((doc) => missingFieldsForActive(doc).length > 0);
    for (const doc of incomplete) {
      const missing = missingFieldsForActive(doc);
      console.log(`${label}: deactivating "${doc.name}" (${doc._id}) — missing: ${missing.join(', ')}`);
      doc.active = false;
      await doc.save();
    }
    console.log(`${label}: ${incomplete.length} deactivated out of ${active.length} active`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
