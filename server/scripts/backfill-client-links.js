'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Client = require('../models/Client');
const { linkClientAuthorization } = require('../services/supabaseLinks');

// One-off backfill: any Client claimed BEFORE public.client_links existed in
// Supabase had its linkClientAuthorization() insert silently fail at claim
// time (same "best-effort, swallow the error" pattern as broadcastToClient).
// Run once after server/scripts/supabase-realtime.sql has been applied.
async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const clients = await Client.find({ supabaseUserId: { $ne: null } });
  console.log(`Found ${clients.length} claimed client(s) to backfill.`);

  for (const client of clients) {
    await linkClientAuthorization(client.supabaseUserId, String(client._id));
    console.log(`  linked ${client.name || client._id} (${client.supabaseUserId})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
