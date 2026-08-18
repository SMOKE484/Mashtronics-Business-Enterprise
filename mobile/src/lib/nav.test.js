import { mapsUrl, mapsWebUrl, telUrl } from './nav';

describe('mapsUrl', () => {
  test('android uses the geo: scheme', () => {
    expect(mapsUrl('12 Acacia Rd, Sandton', 'android')).toBe('geo:0,0?q=12%20Acacia%20Rd%2C%20Sandton');
  });
  test('ios uses the maps: scheme', () => {
    expect(mapsUrl('12 Acacia Rd', 'ios')).toBe('maps:0,0?q=12%20Acacia%20Rd');
  });
  test('encodes &, # and other reserved characters', () => {
    const url = mapsUrl('Unit 4 & 5, #2 Main Rd', 'android');
    expect(url).not.toContain('&');
    expect(url).not.toContain('#');
    expect(url).toContain('%26');
    expect(url).toContain('%23');
  });
  test('null for an empty address', () => {
    expect(mapsUrl('', 'android')).toBeNull();
    expect(mapsUrl(null, 'ios')).toBeNull();
  });
});

describe('mapsWebUrl', () => {
  test('builds a Google Maps search URL', () => {
    expect(mapsWebUrl('12 Acacia Rd')).toBe('https://www.google.com/maps/search/?api=1&query=12%20Acacia%20Rd');
  });
  test('null for empty', () => expect(mapsWebUrl('')).toBeNull());
});

describe('telUrl', () => {
  test('strips spaces and punctuation, keeps a leading +', () => {
    expect(telUrl('+27 82 414 0291')).toBe('tel:+27824140291');
    expect(telUrl('(011) 765-4148')).toBe('tel:0117654148');
  });
  test('null for empty or undialable input', () => {
    expect(telUrl('')).toBeNull();
    expect(telUrl(null)).toBeNull();
    expect(telUrl('n/a')).toBeNull();
    expect(telUrl('12')).toBeNull();
  });
});
