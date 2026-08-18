'use strict';
const { missingFieldsForActive, describeMissingFields } = require('../services/staffActivation');

describe('missingFieldsForActive', () => {
  test('returns no missing fields when phone, email, and role are all set', () => {
    expect(missingFieldsForActive({ phone: '082 123 4567', email: 'a@b.com', role: 'Installer' })).toEqual([]);
  });

  test('flags each blank field individually', () => {
    expect(missingFieldsForActive({ phone: '', email: 'a@b.com', role: 'Installer' })).toEqual(['phone']);
    expect(missingFieldsForActive({ phone: '082 123 4567', email: '', role: 'Installer' })).toEqual(['email']);
    expect(missingFieldsForActive({ phone: '082 123 4567', email: 'a@b.com', role: '' })).toEqual(['role']);
  });

  test('flags whitespace-only fields as missing', () => {
    expect(missingFieldsForActive({ phone: '   ', email: 'a@b.com', role: 'Installer' })).toEqual(['phone']);
  });

  test('flags all three when nothing is set', () => {
    expect(missingFieldsForActive({ phone: '', email: '', role: '' })).toEqual(['phone', 'email', 'role']);
  });

  test('treats undefined fields the same as blank', () => {
    expect(missingFieldsForActive({})).toEqual(['phone', 'email', 'role']);
  });
});

describe('describeMissingFields', () => {
  test('uses singular "is" for one missing field', () => {
    expect(describeMissingFields(['phone'], 'technicians')).toBe(
      'Active technicians need phone, email, and role filled in — phone is missing.'
    );
  });

  test('uses plural "are" for multiple missing fields', () => {
    expect(describeMissingFields(['phone', 'email'], 'response officers')).toBe(
      'Active response officers need phone, email, and role filled in — phone, email are missing.'
    );
  });
});
