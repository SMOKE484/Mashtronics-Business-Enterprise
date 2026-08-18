'use strict';
const twilio = require('twilio');

// Constructed lazily so a missing/invalid TWILIO_* env var only breaks an
// actual send attempt, not every server boot or unrelated test run.
let client = null;
function getClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

async function sendInviteSms(toE164, code) {
  await getClient().messages.create({
    to: toE164,
    from: process.env.TWILIO_FROM_NUMBER,
    body: `Your Mashtronics SecureWatch invite code is ${code}. It expires in 7 days. Enter it in the app to link your account.`,
  });
}

module.exports = { sendInviteSms };
