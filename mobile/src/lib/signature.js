// Signature capture math for the sign-off SignaturePad. Pure functions —
// unit tested in signature.test.js. Strokes are captured as point lists,
// downsampled + integer-quantized here, and serialized to SVG path strings
// that go to the server (POST /api/app/jobs/:id/complete). The server
// enforces the same charset + size limits (server/routes/appJobs.js).

export const SIGNATURE_MAX_CHARS = 12000;
export const MIN_POINT_DISTANCE = 2;

// Appends a point to a stroke only if it moved at least minDist pixels from
// the previous point — keeps payloads small without visibly changing the
// drawn line. Coordinates are rounded to integers. Returns a new array.
export function appendPoint(points, x, y, minDist = MIN_POINT_DISTANCE) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (points.length > 0) {
    const last = points[points.length - 1];
    const dx = px - last.x;
    const dy = py - last.y;
    if (dx * dx + dy * dy < minDist * minDist) return points;
  }
  return [...points, { x: px, y: py }];
}

// One stroke -> one SVG path string ("M10 20L14 24L19 27"). A single tap
// (one point) becomes a dot via a 1px line so it still renders.
export function pointsToSvgPath(points) {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (rest.length === 0) return `M${first.x} ${first.y}L${first.x + 1} ${first.y}`;
  return `M${first.x} ${first.y}` + rest.map((p) => `L${p.x} ${p.y}`).join('');
}

// Total serialized size of a signature (joined path chars) — checked against
// SIGNATURE_MAX_CHARS before submit, mirroring the server cap.
export function signatureSize(svgPaths) {
  return svgPaths.reduce((sum, p) => sum + p.length, 0);
}
