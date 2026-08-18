// Stroke icon set — ported 1:1 from mashtronics/ui.jsx (SWIcon).
// All 24x24 viewBox, round caps/joins. Path data must stay in sync with the
// prototype so the app and the design spec render identically.

import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

// Each icon is a list of primitive descriptors:
//   { d }                    → stroked Path
//   { rect: [x,y,w,h,rx] }   → stroked Rect
//   { circle: [cx,cy,r] }    → stroked Circle
//   { circle: [...], fill: true } → filled Circle (no stroke)
const ICONS = {
  home: [{ d: 'M3.5 11L12 4l8.5 7' }, { d: 'M5.5 9.8V19a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1V9.8' }],
  camera: [{ rect: [3, 6.5, 14, 11, 2] }, { d: 'M17 10l4-2v9l-4-2' }, { circle: [9, 12, 2.5] }],
  activity: [{ d: 'M3 12h4l2-6 4 12 2-6h6' }],
  chat: [{ d: 'M4 5h16v11H9l-4 4V5z' }, { d: 'M8 10h8M8 13h5' }],
  user: [{ circle: [12, 8, 3.5] }, { d: 'M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6' }],
  bell: [{ d: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z' }, { d: 'M10 20a2 2 0 0 0 4 0' }],
  chevR: [{ d: 'M9 6l6 6-6 6' }],
  chevL: [{ d: 'M15 6l-6 6 6 6' }],
  chevD: [{ d: 'M6 9l6 6 6-6' }],
  plus: [{ d: 'M12 5v14' }, { d: 'M5 12h14' }],
  x: [{ d: 'M6 6l12 12' }, { d: 'M18 6l-6 12' }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7' }],
  shield: [{ d: 'M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z' }],
  pin: [{ d: 'M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z' }, { circle: [12, 9, 2.5] }],
  phone: [{ d: 'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z' }],
  image: [{ rect: [3, 4, 18, 16, 2] }, { circle: [9, 10, 2] }, { d: 'M21 17l-5-5-9 9' }],
  paperclip: [{ d: 'M21 11.5l-9 9a5 5 0 0 1-7-7L13 5a3.5 3.5 0 0 1 5 5l-7.5 7.5a2 2 0 0 1-3-3L14 8' }],
  send: [{ d: 'M21 4L3 11l6 2 2 6 10-15z' }, { d: 'M9 13l4-4' }],
  search: [{ circle: [11, 11, 6.5] }, { d: 'M16 16l4.5 4.5' }],
  settings: [
    { circle: [12, 12, 3] },
    { d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
  ],
  wifi: [{ d: 'M5 12.5a10 10 0 0 1 14 0' }, { d: 'M8 15.5a6 6 0 0 1 8 0' }, { circle: [12, 18.5, 1], fill: true }],
  wifiOff: [
    { d: 'M3 3l18 18' },
    { d: 'M16.7 16.7a6 6 0 0 0-8.4 0' },
    { d: 'M5 12.5a10 10 0 0 1 5-2.7' },
    { d: 'M14 9.8a10 10 0 0 1 5 2.7' },
    { circle: [12, 18.5, 1], fill: true },
  ],
  bolt: [{ d: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z' }],
  doc: [{ d: 'M7 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z' }, { d: 'M15 3v4h4' }, { d: 'M9 13h6M9 17h4' }],
  truck: [{ rect: [2, 7, 12, 9, 1] }, { d: 'M14 10h4l3 3v3h-7' }, { circle: [6, 17.5, 1.8] }, { circle: [17, 17.5, 1.8] }],
  wrench: [{ d: 'M14 7a4 4 0 0 1 5 5l-9 9a2.8 2.8 0 1 1-4-4l9-9a4 4 0 0 1-1-1z' }],
  arrowUp: [{ d: 'M12 19V5' }, { d: 'M5 12l7-7 7 7' }],
  map: [{ d: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z' }, { d: 'M9 4v14M15 6v14' }],
  info: [{ circle: [12, 12, 9] }, { d: 'M12 8h.01M11 12h1v5h1' }],
  star: [{ d: 'M12 3l2.7 5.7 6.3.9-4.5 4.5 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.3-.9L12 3z' }],
  logout: [{ d: 'M14 8V5a1 1 0 0 0-1-1H4v16h9a1 1 0 0 0 1-1v-3' }, { d: 'M9 12h12l-3-3M21 12l-3 3' }],
  checklist: [{ rect: [5, 3, 14, 18, 2] }, { d: 'M9 2.5h6v3H9z' }, { d: 'M8 11.5l1.8 1.8L13.5 9.5' }, { d: 'M8 16h6' }],
  cameraPlus: [{ rect: [2.5, 7.5, 13, 10, 2] }, { d: 'M15.5 10.5l4-2v8l-4-2' }, { circle: [8, 12.5, 2.2] }, { d: 'M19 2.5v4M17 4.5h4' }],
  signature: [{ d: 'M4 20h4L18 10a2.5 2.5 0 0 0-3.5-3.5L4 17v3z' }, { d: 'M13 8l3 3' }],
  navigate: [{ d: 'M12 2L4 21l8-5 8 5z' }],
  volumeOn: [
    { d: 'M4 9v6h3l4 3.5V5.5L7 9H4z' },
    { d: 'M15.5 9a4 4 0 0 1 0 6' },
    { d: 'M18 6.5a8 8 0 0 1 0 11' },
  ],
  volumeOff: [
    { d: 'M4 9v6h3l4 3.5V5.5L7 9H4z' },
    { d: 'M15.5 9l5 6' },
    { d: 'M20.5 9l-5 6' },
  ],
};

export const ICON_NAMES = Object.keys(ICONS);

export default function Icon({ name, size = 22, color = '#F2F6F8', strokeWidth = 1.75 }) {
  const parts = ICONS[name];
  if (!parts) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {parts.map((p, i) => {
        if (p.d) {
          return (
            <Path key={i} d={p.d} stroke={color} strokeWidth={strokeWidth}
              strokeLinecap="round" strokeLinejoin="round" fill="none" />
          );
        }
        if (p.rect) {
          const [x, y, w, h, rx] = p.rect;
          return (
            <Rect key={i} x={x} y={y} width={w} height={h} rx={rx}
              stroke={color} strokeWidth={strokeWidth}
              strokeLinecap="round" strokeLinejoin="round" fill="none" />
          );
        }
        if (p.circle) {
          const [cx, cy, r] = p.circle;
          return p.fill
            ? <Circle key={i} cx={cx} cy={cy} r={r} fill={color} />
            : <Circle key={i} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth} fill="none" />;
        }
        return null;
      })}
    </Svg>
  );
}
