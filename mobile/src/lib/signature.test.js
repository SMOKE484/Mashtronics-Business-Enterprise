import { appendPoint, pointsToSvgPath, signatureSize, SIGNATURE_MAX_CHARS } from './signature';

describe('appendPoint', () => {
  test('always accepts the first point, rounded to integers', () => {
    expect(appendPoint([], 10.6, 20.4)).toEqual([{ x: 11, y: 20 }]);
  });

  test('drops points closer than the minimum distance', () => {
    const points = [{ x: 10, y: 10 }];
    expect(appendPoint(points, 11, 10)).toBe(points); // 1px move — dropped, same array back
  });

  test('keeps points at or beyond the minimum distance', () => {
    const points = appendPoint([{ x: 10, y: 10 }], 12, 10);
    expect(points).toEqual([{ x: 10, y: 10 }, { x: 12, y: 10 }]);
  });

  test('does not mutate the input array', () => {
    const input = [{ x: 0, y: 0 }];
    appendPoint(input, 50, 50);
    expect(input).toHaveLength(1);
  });

  test('downsampling keeps a long fast stroke bounded', () => {
    // simulate a 60Hz drag across 300px with tiny jitter
    let points = [];
    for (let i = 0; i < 600; i++) points = appendPoint(points, i / 2, 50 + (i % 2) * 0.4);
    expect(points.length).toBeLessThan(200);
  });
});

describe('pointsToSvgPath', () => {
  test('serializes a stroke to M/L commands', () => {
    expect(pointsToSvgPath([{ x: 10, y: 20 }, { x: 14, y: 24 }, { x: 19, y: 27 }])).toBe('M10 20L14 24L19 27');
  });

  test('a single tap becomes a 1px line so it renders as a dot', () => {
    expect(pointsToSvgPath([{ x: 5, y: 5 }])).toBe('M5 5L6 5');
  });

  test('empty stroke -> empty string', () => {
    expect(pointsToSvgPath([])).toBe('');
  });

  test('output survives the server charset rule', () => {
    const path = pointsToSvgPath([{ x: 10, y: 20 }, { x: 14, y: 24 }]);
    expect(path).toMatch(/^[MLmlZz0-9 .,-]+$/);
  });
});

describe('signatureSize', () => {
  test('sums joined path lengths', () => {
    expect(signatureSize(['M0 0L1 1', 'M2 2L3 3'])).toBe(16);
  });
  test('a realistic signature stays far under the cap', () => {
    let points = [];
    for (let i = 0; i < 400; i++) points = appendPoint(points, (i * 3) % 300, 50 + Math.sin(i / 10) * 40);
    const paths = [pointsToSvgPath(points)];
    expect(signatureSize(paths)).toBeLessThan(SIGNATURE_MAX_CHARS / 2);
  });
});
