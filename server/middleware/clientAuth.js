'use strict';
const jwt         = require('jsonwebtoken');
const jwksClient   = require('jwks-rsa');
const Client       = require('../models/Client');

// Verifies a Supabase-issued JWT (SecureWatch app identity) and resolves it
// to the linked Client record. Separate from admin requireAuth by design —
// see CLAUDE.md / features.md Track C.
//
// Supabase projects created (or migrated) onto its newer JWT signing-key
// system sign access tokens asymmetrically (RS256/ES256) rather than with the
// legacy shared HS256 secret — a shared-secret jwt.verify() call fails every
// token with "invalid algorithm" in that case, no matter what secret value is
// used. Verifying against Supabase's published JWKS works for both legacy
// and current projects, so it's used unconditionally here.
const jwks = jwksClient({
  jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
});

function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

async function verifySupabaseToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Token missing kid header');
  }
  const publicKey = await getSigningKey(decoded.header.kid);
  return jwt.verify(token, publicKey, { algorithms: ['RS256', 'ES256'] });
}

async function requireClientAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  let payload;
  try {
    payload = await verifySupabaseToken(token);
  } catch (err) {
    console.error('[requireClientAuth] token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    const client = await Client.findOne({ supabaseUserId: payload.sub, archived: false });
    if (!client) return res.status(401).json({ error: 'No linked client account' });
    req.client = client;
    req.supabaseUserId = payload.sub;
    next();
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { requireClientAuth, verifySupabaseToken };
