// Lightweight client-side sanity check for South African phone numbers —
// just enough to enable/disable the submit button and give immediate
// feedback. The server (server/services/phone.js) is the source of truth
// for normalization/validation; this intentionally doesn't duplicate it.
export function looksLikeSAPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length === 9 || digits.length === 10 || (digits.length === 11 && digits.startsWith('27'));
}
