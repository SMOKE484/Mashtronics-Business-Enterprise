'use strict';
const nodemailer = require('nodemailer');

// Constructed lazily so a missing/invalid SMTP_* env var only breaks an
// actual send attempt, not every server boot or unrelated test run.
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendInviteEmail(toEmail, code) {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Your Mashtronics SecureWatch invite code',
    text: `Your invite code is ${code}. It expires in 7 days. Enter it in the SecureWatch app to link your account.`,
    html: `<p>Your invite code is <strong>${code}</strong>.</p><p>It expires in 7 days. Enter it in the SecureWatch app to link your account.</p>`,
  });
}

module.exports = { sendInviteEmail };
