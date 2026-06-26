'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');
const AdminUser = require('../models/AdminUser');
const Package   = require('../models/Package');
const Counter   = require('../models/Counter');

const PACKAGES = [
  {
    name:         '4-Camera CCTV Package',
    description:  'NVR, HDD, 4 cameras, cabling, and accessories. Fully installed.',
    cameraCount:  4,
    priceInclVAT: 12000,
    category:     'residential',
  },
  {
    name:         '6-Camera CCTV Package',
    description:  'NVR, HDD, 6 cameras, cabling, and accessories. Fully installed.',
    cameraCount:  6,
    priceInclVAT: 14000,
    category:     'residential',
  },
  {
    name:         '8-Camera CCTV Package',
    description:  'NVR, HDD, 8 cameras, cabling, and accessories. Fully installed.',
    cameraCount:  8,
    priceInclVAT: 16000,
    category:     'residential',
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Admin user
  const existing = await AdminUser.findOne({ username: 'admin' });
  if (!existing) {
    const rawPassword  = process.env.ADMIN_PASSWORD || 'changeme123';
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    await AdminUser.create({ username: 'admin', passwordHash, role: 'admin' });
    console.log('Admin user created (username: admin)');
  } else {
    console.log('Admin user already exists — skipped');
  }

  // Packages
  for (const pkg of PACKAGES) {
    const exists = await Package.findOne({ name: pkg.name });
    if (!exists) {
      await Package.create(pkg);
      console.log(`Package created: ${pkg.name}`);
    } else {
      console.log(`Package exists: ${pkg.name} — skipped`);
    }
  }

  // Quote number counter — $setOnInsert means re-running seed won't reset an advanced counter
  await Counter.findOneAndUpdate(
    { name: 'quoteNumber' },
    { $setOnInsert: { seq: 1003 } },
    { returnDocument: 'after', upsert: true }
  );
  console.log('Counter initialised (seq: 1003 → first quote will be Q1004)');

  await mongoose.disconnect();
  console.log('Seed complete');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
