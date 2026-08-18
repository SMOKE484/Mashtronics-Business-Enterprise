// Maps/phone deep-linking for the technician job screens: hand off to the
// phone's native maps app for navigation (in-app turn-by-turn is explicitly
// out of scope — architecture decision, see HANDOFF) and the dialer for
// calls. URL builders are pure (unit tested); the open* wrappers do the
// Linking side effects and RETURN errors instead of throwing, so screens can
// show inline feedback — a tap must never fail silently.

import { Linking, Platform } from 'react-native';

// Platform-native maps search URL for a free-text address.
export function mapsUrl(address, platform = Platform.OS) {
  if (!address) return null;
  const q = encodeURIComponent(address);
  return platform === 'ios' ? `maps:0,0?q=${q}` : `geo:0,0?q=${q}`;
}

// Web fallback when no native maps app handles the scheme.
export function mapsWebUrl(address) {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// "+27 82 414 0291" -> "tel:+27824140291". Null when nothing dialable.
export function telUrl(phone) {
  const cleaned = String(phone || '').replace(/[^\d+]/g, '');
  if (!/^\+?\d{3,}$/.test(cleaned)) return null;
  return `tel:${cleaned}`;
}

// Both wrappers resolve to null on success or a short human message on
// failure (never throw) — callers render the message inline.
export async function openMaps(address) {
  const native = mapsUrl(address);
  if (!native) return 'No address on file for this job';
  try {
    if (await Linking.canOpenURL(native)) {
      await Linking.openURL(native);
      return null;
    }
    await Linking.openURL(mapsWebUrl(address));
    return null;
  } catch {
    return "Couldn't open a maps app on this phone";
  }
}

export async function callPhone(phone) {
  const url = telUrl(phone);
  if (!url) return 'No phone number on file for this client';
  try {
    await Linking.openURL(url);
    return null;
  } catch {
    return "Couldn't open the dialer";
  }
}
