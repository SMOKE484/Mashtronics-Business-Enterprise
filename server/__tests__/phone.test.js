'use strict';
const { normalizeSAPhone } = require('../services/phone');

describe('normalizeSAPhone', () => {
  test.each([
    ['0821234567', '+27821234567'],
    ['082 123 4567', '+27821234567'],
    ['082-123-4567', '+27821234567'],
    ['+27821234567', '+27821234567'],
    ['+27 82 123 4567', '+27821234567'],
    ['27821234567', '+27821234567'],
    ['821234567', '+27821234567'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeSAPhone(input)).toBe(expected);
  });

  test('rejects empty string', () => {
    expect(() => normalizeSAPhone('')).toThrow('Phone number is required');
  });

  test('rejects whitespace-only string', () => {
    expect(() => normalizeSAPhone('   ')).toThrow('Phone number is required');
  });

  test('rejects null/undefined', () => {
    expect(() => normalizeSAPhone(null)).toThrow('Phone number is required');
    expect(() => normalizeSAPhone(undefined)).toThrow('Phone number is required');
  });

  test('rejects a too-short number', () => {
    expect(() => normalizeSAPhone('12345')).toThrow(/valid South African/);
  });

  test('rejects a too-long number', () => {
    expect(() => normalizeSAPhone('082123456789')).toThrow(/valid South African/);
  });

  test('rejects a non-SA country code', () => {
    expect(() => normalizeSAPhone('+14155552671')).toThrow(/valid South African/);
  });

  test('rejects a malformed double-leading-zero number', () => {
    expect(() => normalizeSAPhone('+270821234567')).toThrow(/valid South African/);
  });

  test('rejects a national number starting with 0 after stripping the leading 0', () => {
    expect(() => normalizeSAPhone('00821234567')).toThrow(/valid South African/);
  });

  test('rejects letters mixed into the number', () => {
    expect(() => normalizeSAPhone('082abc4567')).toThrow(/valid South African/);
  });
});
