// Fetch wrapper for the Express API (server/). All /api/app/* endpoints
// authenticate with the Supabase access token as a bearer.

import { supabase } from './supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(status, message) {
    super(message || `Request failed (${status})`);
    this.status = status;
  }
}

// AuthContext registers here so an admin unlinking the account mid-session
// kicks the app back to the claim screen instead of failing silently. Covers
// both client and staff (technician/response) unlink messages — once
// unlinked, the app reacts the same way regardless of which account type.
let unlinkedHandler = null;
export function onUnlinked(cb) {
  unlinkedHandler = cb;
}

const UNLINK_MESSAGES = ['No linked client account', 'No linked staff account'];

export async function api(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  let json = null;
  try { json = await res.json(); } catch { /* empty/non-JSON body */ }

  if (!res.ok) {
    const message = json && json.error;
    if (res.status === 401 && UNLINK_MESSAGES.includes(message) && unlinkedHandler) {
      unlinkedHandler();
    }
    throw new ApiError(res.status, message);
  }
  return json;
}
