// SecureWatch design tokens — ported from mashtronics/ui.jsx (SW_TOKENS).
// The prototype is the visual source of truth; keep values in sync with it.

export const T = {
  ink:        '#08121A',
  surface:    '#0F1C26',
  elev:       '#16242F',
  elev2:      '#1E303D',
  hairline:   'rgba(255,255,255,0.07)',
  hairline2:  'rgba(255,255,255,0.12)',
  text:       '#F2F6F8',
  textDim:    '#A7B6C2',
  textMuted:  '#6B7E8C',
  online:     '#7AB23C',
  onlineSoft: '#9FCE63',
  offline:    '#F59E0B',
  danger:     '#FF3B30',
  dangerDeep: '#B8261F',
  info:       '#2BA0C6',
  brandTeal:  '#1A7A9E',
  brandTealSoft: '#2BA0C6',
  brandGreen: '#7AB23C',
};

// RN needs one fontFamily per weight (no CSS stacks / fontWeight synthesis
// for custom fonts). Family names match the keys passed to useFonts in App.js.
export const F = {
  regular:  'Geist-Regular',
  medium:   'Geist-Medium',
  semibold: 'Geist-SemiBold',
  bold:     'Geist-Bold',
  mono:     'GeistMono-Regular',
  monoMedium: 'GeistMono-Medium',
  monoSemibold: 'GeistMono-SemiBold',
};

// Screen-level layout constants from the prototype.
export const LAYOUT = {
  screenPad: 20,   // horizontal padding on every screen
  cardRadius: 18,
};
