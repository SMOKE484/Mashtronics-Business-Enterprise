'use strict';
const fetch = require('node-fetch');

// Server-side Supabase Storage access for the private `job-photos` bucket,
// using the service role key (raw REST, same pattern as realtime.js /
// supabaseLinks.js — no supabase-js on the server).
//
// Read paths degrade gracefully: createSignedUrls returns nulls and
// objectExists returns false on any failure, so a Storage outage can never
// take a whole jobs response down — callers decide what a null/false means.

const BUCKET = 'job-photos';

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function serviceHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

// Batch-signs object paths. Returns a Map<path, fullUrl|null>; every input
// path is present in the result, failures map to null.
async function createSignedUrls(paths, expiresIn = 3600) {
  const result = new Map(paths.map((p) => [p, null]));
  if (!configured() || paths.length === 0) return result;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/sign/${BUCKET}`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify({ expiresIn, paths }),
    });
    if (!res.ok) {
      console.error('[storage] signing failed:', res.status, await res.text().catch(() => ''));
      return result;
    }
    const entries = await res.json();
    for (const entry of entries) {
      // Batch response items carry `path` + `signedURL` (relative) on
      // success, `error` on per-path failure.
      if (entry && entry.path && entry.signedURL && result.has(entry.path)) {
        result.set(entry.path, `${process.env.SUPABASE_URL}/storage/v1${entry.signedURL}`);
      }
    }
    return result;
  } catch (err) {
    console.error('[storage] signing failed:', err.message);
    return result;
  }
}

// True only when the object definitely exists — used to reject recording a
// photo path whose upload never actually completed. Network failure returns
// false (the caller rejects the record; the app can retry).
async function objectExists(path) {
  if (!configured()) return false;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/info/${BUCKET}/${path}`, {
      headers: serviceHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.error('[storage] existence check failed:', err.message);
    return false;
  }
}

// Best-effort delete (photo removal from the app). Failure is logged, never
// thrown — the Mongo array is the source of truth for what a job shows.
async function deleteObject(path) {
  if (!configured()) return false;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'DELETE',
      headers: serviceHeaders(),
    });
    if (!res.ok) console.error('[storage] delete failed:', res.status);
    return res.ok;
  } catch (err) {
    console.error('[storage] delete failed:', err.message);
    return false;
  }
}

module.exports = { createSignedUrls, objectExists, deleteObject, BUCKET };
