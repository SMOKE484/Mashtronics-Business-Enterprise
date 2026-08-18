import { formatDuration, formatHistoryDate } from './format';

describe('formatDuration', () => {
  test('minutes only', () => expect(formatDuration(45)).toBe('45m'));
  test('hours and minutes', () => expect(formatDuration(80)).toBe('1h 20m'));
  test('exact hours drop the minutes part', () => expect(formatDuration(120)).toBe('2h'));
  test('zero is 0m, not null', () => expect(formatDuration(0)).toBe('0m'));
  test('null/undefined/negative/NaN -> null', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(-5)).toBeNull();
    expect(formatDuration(NaN)).toBeNull();
  });
});

describe('formatHistoryDate', () => {
  test('formats as "DD Mon"', () => {
    expect(formatHistoryDate('2026-07-09T10:00:00Z')).toBe('09 Jul');
  });
  test('accepts Date objects', () => {
    expect(formatHistoryDate(new Date(2026, 11, 25))).toBe('25 Dec');
  });
  test('empty for null/invalid input', () => {
    expect(formatHistoryDate(null)).toBe('');
    expect(formatHistoryDate('garbage')).toBe('');
  });
});
