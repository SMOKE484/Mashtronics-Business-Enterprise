'use strict';
const crypto = require('crypto');
const fetch  = require('node-fetch');

// Real implementation of the Dahua Open ARC "Simplified Signature Mode" auth
// chain, proven live against Frankfurt in the 2026-08-01 session (see
// HANDOFF.md). Three token tiers, each layered on the last:
//   getAppAccessToken()  — developer/product-level, signed with AK+SK only
//   getUserAccessToken() — ARC company login, needs a salted password (getSalt)
//                          and is itself signed with the AppAccessToken
//   signedRequest()      — business calls, signed with AK+AppAccessToken(+UserAccessToken)
//
// Env vars read lazily (not at module load, matching sms.js/storage.js's
// convention) so a missing var only breaks an actual Dahua call, not server
// boot or unrelated tests.

function config() {
  const required = {
    DAHUA_ACCESS_KEY:        process.env.DAHUA_ACCESS_KEY,
    DAHUA_SECRET_ACCESS_KEY: process.env.DAHUA_SECRET_ACCESS_KEY,
    DAHUA_API_DOMAIN:        process.env.DAHUA_API_DOMAIN,
    DAHUA_PRODUCT_ID:        process.env.DAHUA_PRODUCT_ID,
  };
  for (const [name, value] of Object.entries(required)) {
    if (!value) throw new Error(`${name} is not set — see server/.env.example`);
  }
  return required;
}

function arcConfig() {
  const email    = process.env.DAHUA_ARC_EMAIL;
  const password = process.env.DAHUA_ARC_PASSWORD;
  if (!email || !password) {
    throw new Error('DAHUA_ARC_EMAIL/DAHUA_ARC_PASSWORD are not set — see server/.env.example');
  }
  return { email, password };
}

// HMAC-SHA512(strAuthFactor, secretAccessKey), uppercase hex — the one
// signature primitive every tier below uses with a different strAuthFactor.
function sign(strAuthFactor, secretAccessKey) {
  return crypto.createHmac('sha512', secretAccessKey).update(strAuthFactor).digest('hex').toUpperCase();
}

function baseHeaders({ accessKey, productId, timestamp, nonce, signature }) {
  return {
    'Content-Type':     'application/json',
    'Accept-Language':  'en-US',
    'Version':          'v1',
    'Sign-Type':        'simple',
    'AccessKey':        accessKey,
    'ProductId':        productId,
    'Timestamp':        timestamp,
    'Nonce':             nonce,
    'Sign':             signature,
    'X-TraceId-Header': crypto.randomUUID(),
  };
}

async function postJson(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success !== true) {
    const detail = json ? `${json.code || res.status} ${json.msg || ''}`.trim() : `HTTP ${res.status}`;
    throw new Error(`Dahua API ${url} failed: ${detail}`);
  }
  return json.data;
}

// ---- Tier 1: AppAccessToken (developer/product level) ----

let appToken = null; // { value, expiresAt }

async function fetchAppAccessToken() {
  const { DAHUA_ACCESS_KEY: accessKey, DAHUA_SECRET_ACCESS_KEY: secretKey, DAHUA_API_DOMAIN: domain, DAHUA_PRODUCT_ID: productId } = config();
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const signature = sign(accessKey + timestamp + nonce, secretKey);
  const headers = baseHeaders({ accessKey, productId, timestamp, nonce, signature });
  const data = await postJson(`${domain}/open-api/api-base/auth/getAppAccessToken`, headers, {});
  return { value: data.appAccessToken, validitySeconds: Number(data.validitySeconds) };
}

// 60s safety margin so a token doesn't expire mid-flight.
async function getAppAccessToken() {
  if (appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.value;
  const { value, validitySeconds } = await fetchAppAccessToken();
  appToken = { value, expiresAt: Date.now() + validitySeconds * 1000 };
  return appToken.value;
}

// ---- Tier 2: UserAccessToken (ARC company login) ----

let userToken = null; // { value, expiresAt }

async function getSalt(accountEmail, appAccessToken) {
  const { DAHUA_ACCESS_KEY: accessKey, DAHUA_SECRET_ACCESS_KEY: secretKey, DAHUA_API_DOMAIN: domain, DAHUA_PRODUCT_ID: productId } = config();
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const signature = sign(accessKey + appAccessToken + timestamp + nonce, secretKey);
  const headers = { ...baseHeaders({ accessKey, productId, timestamp, nonce, signature }), AppAccessToken: appAccessToken };
  return postJson(`${domain}/open-api/api-converter/user/getSalt`, headers, { accountEmail, saltType: 2 });
}

// Salted password per the FAQ "Generate a salted signature for the plaintext
// password": content = HMAC_SHA512(key=salt, msg=password); result =
// HMAC_SHA512(key=random, msg=content) — both steps lowercase hex.
function saltedPassword(plainPassword, salt, random) {
  const content = crypto.createHmac('sha512', salt).update(plainPassword).digest('hex');
  return crypto.createHmac('sha512', random).update(content).digest('hex');
}

async function fetchUserAccessToken() {
  const { email, password } = arcConfig();
  const { DAHUA_ACCESS_KEY: accessKey, DAHUA_SECRET_ACCESS_KEY: secretKey, DAHUA_API_DOMAIN: domain, DAHUA_PRODUCT_ID: productId } = config();
  const appAccessToken = await getAppAccessToken();
  const { salt, random } = await getSalt(email, appAccessToken);
  const encryptedPassword = saltedPassword(password, salt, random);

  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const signature = sign(accessKey + appAccessToken + timestamp + nonce, secretKey);
  const headers = { ...baseHeaders({ accessKey, productId, timestamp, nonce, signature }), AppAccessToken: appAccessToken };
  const data = await postJson(`${domain}/open-api/api-converter/user/login`, headers, { accountEmail: email, password: encryptedPassword });
  return { value: data.userAccessToken, validitySeconds: Number(data.validitySeconds) };
}

async function getUserAccessToken() {
  if (userToken && userToken.expiresAt > Date.now() + 60_000) return userToken.value;
  const { value, validitySeconds } = await fetchUserAccessToken();
  userToken = { value, expiresAt: Date.now() + validitySeconds * 1000 };
  return userToken.value;
}

// ---- Tier 3: business calls ----

// requireUserToken: false for Open ARC APIs callable before/without a
// converter user login (e.g. messageAck); true for APIs the docs explicitly
// say need the UserAccessToken header (e.g. setActivationStatus).
async function signedRequest(path, body, { requireUserToken = false } = {}) {
  const { DAHUA_ACCESS_KEY: accessKey, DAHUA_SECRET_ACCESS_KEY: secretKey, DAHUA_API_DOMAIN: domain, DAHUA_PRODUCT_ID: productId } = config();
  const appAccessToken = await getAppAccessToken();
  const userAccessToken = requireUserToken ? await getUserAccessToken() : '';

  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const strAuthFactor = accessKey + appAccessToken + userAccessToken + timestamp + nonce;
  const signature = sign(strAuthFactor, secretKey);
  const headers = {
    ...baseHeaders({ accessKey, productId, timestamp, nonce, signature }),
    AppAccessToken: appAccessToken,
    ...(userAccessToken ? { UserAccessToken: userAccessToken } : {}),
  };
  return postJson(`${domain}${path}`, headers, body);
}

module.exports = { getAppAccessToken, getUserAccessToken, signedRequest, saltedPassword };
