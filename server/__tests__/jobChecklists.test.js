'use strict';
const { checklistForJobType, TEMPLATES } = require('../services/jobChecklists');

describe('checklistForJobType', () => {
  test('matches "install" as a substring of free-text job types', () => {
    const items = checklistForJobType('CCTV install');
    expect(items.map((i) => i.label)).toEqual(TEMPLATES.install);
  });

  test('is case-insensitive', () => {
    expect(checklistForJobType('CCTV INSTALL').map((i) => i.label)).toEqual(TEMPLATES.install);
    expect(checklistForJobType('Annual Maintenance visit').map((i) => i.label)).toEqual(TEMPLATES.service);
  });

  test('matches service and maintenance to the service template', () => {
    expect(checklistForJobType('service call').map((i) => i.label)).toEqual(TEMPLATES.service);
    expect(checklistForJobType('quarterly maintenance').map((i) => i.label)).toEqual(TEMPLATES.service);
  });

  test('matches repair, fix and fault to the repair template', () => {
    expect(checklistForJobType('Camera repair').map((i) => i.label)).toEqual(TEMPLATES.repair);
    expect(checklistForJobType('fix garage camera').map((i) => i.label)).toEqual(TEMPLATES.repair);
    expect(checklistForJobType('fault finding').map((i) => i.label)).toEqual(TEMPLATES.repair);
  });

  test('falls back to the generic template for unknown types', () => {
    expect(checklistForJobType('Site survey').map((i) => i.label)).toEqual(TEMPLATES.generic);
  });

  test('handles empty, null and undefined jobType without throwing', () => {
    for (const input of ['', null, undefined]) {
      expect(checklistForJobType(input).map((i) => i.label)).toEqual(TEMPLATES.generic);
    }
  });

  test('every item is { label, done: false } with a non-empty label', () => {
    for (const type of ['install', 'service', 'repair', 'unknown']) {
      for (const item of checklistForJobType(type)) {
        expect(typeof item.label).toBe('string');
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.done).toBe(false);
      }
    }
  });

  test('returns a fresh array each call (no shared mutable state)', () => {
    const a = checklistForJobType('install');
    const b = checklistForJobType('install');
    expect(a).not.toBe(b);
    a[0].done = true;
    expect(b[0].done).toBe(false);
  });
});
