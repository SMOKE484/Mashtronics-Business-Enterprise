'use strict';
const { toAppProfile } = require('../services/clients');

const baseClient = {
  _id: '652f1a2b3c4d5e6f7a8b9c00',
  name: 'Tumi Mokoena',
  sector: 'Residential',
  status: 'active',
  clientSince: new Date('2025-01-11'),
  scopeOfWork: 'CCTV install + maintenance',
  billingAddress: '12 Acacia Rd, Sandton',
  contactName: 'Tumi Mokoena',
  contactPhone: '+27 82 414 0291',
  contactEmail: 'tumi.m@gmail.com',
  notes: 'internal note',
  archived: false,
  supabaseUserId: 'a1b2c3d4-0000-0000-0000-000000000000',
  appInviteCode: '3F9A2B1C',
  appInviteExpiresAt: new Date('2026-07-16'),
};

describe('toAppProfile', () => {
  test('shapes a client doc to the app-facing fields only', () => {
    expect(toAppProfile(baseClient)).toEqual({
      clientId: '652f1a2b3c4d5e6f7a8b9c00',
      name: 'Tumi Mokoena',
      contactName: 'Tumi Mokoena',
      contactEmail: 'tumi.m@gmail.com',
      contactPhone: '+27 82 414 0291',
      billingAddress: '12 Acacia Rd, Sandton',
      clientSince: new Date('2025-01-11'),
    });
  });

  test('clientId is the stringified _id', () => {
    const out = toAppProfile(baseClient);
    expect(typeof out.clientId).toBe('string');
    expect(out.clientId).toBe(String(baseClient._id));
  });

  test('never exposes auth linkage, invite, or internal fields', () => {
    const out = toAppProfile(baseClient);
    expect(out).not.toHaveProperty('supabaseUserId');
    expect(out).not.toHaveProperty('appInviteCode');
    expect(out).not.toHaveProperty('appInviteExpiresAt');
    expect(out).not.toHaveProperty('notes');
    expect(out).not.toHaveProperty('scopeOfWork');
    expect(out).not.toHaveProperty('archived');
  });
});
