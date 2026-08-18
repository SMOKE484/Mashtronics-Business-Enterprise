'use strict';
const { toTechnicianAppProfile } = require('../services/technicians');
const { toResponseAppProfile } = require('../services/responseOfficers');

const baseTechnician = {
  _id: '652f1a2b3c4d5e6f7a8b9c01',
  name: 'David Nkosi',
  phone: '+27 82 111 2233',
  email: 'david@mashtronicsbe.co.za',
  role: 'CCTV Installer',
  active: true,
  supabaseUserId: 'a1b2c3d4-0000-0000-0000-000000000001',
  appInviteCode: '3F9A2B1C',
  appInviteExpiresAt: new Date('2026-07-16'),
};

const baseOfficer = {
  _id: '652f1a2b3c4d5e6f7a8b9c02',
  name: 'Thabo Mahlangu',
  phone: '+27 82 444 5566',
  email: 'thabo@mashtronicsbe.co.za',
  role: 'Response Officer',
  active: true,
  supabaseUserId: 'a1b2c3d4-0000-0000-0000-000000000002',
  appInviteCode: '9012ABCD',
  appInviteExpiresAt: new Date('2026-07-16'),
};

describe('toTechnicianAppProfile', () => {
  test('shapes a technician doc to the app-facing fields only', () => {
    expect(toTechnicianAppProfile(baseTechnician)).toEqual({
      staffId: '652f1a2b3c4d5e6f7a8b9c01',
      name: 'David Nkosi',
      email: 'david@mashtronicsbe.co.za',
      phone: '+27 82 111 2233',
      role: 'CCTV Installer',
    });
  });

  test('staffId is the stringified _id', () => {
    const out = toTechnicianAppProfile(baseTechnician);
    expect(typeof out.staffId).toBe('string');
    expect(out.staffId).toBe(String(baseTechnician._id));
  });

  test('never exposes auth linkage or invite fields', () => {
    const out = toTechnicianAppProfile(baseTechnician);
    expect(out).not.toHaveProperty('supabaseUserId');
    expect(out).not.toHaveProperty('appInviteCode');
    expect(out).not.toHaveProperty('appInviteExpiresAt');
    expect(out).not.toHaveProperty('active');
  });
});

describe('toResponseAppProfile', () => {
  test('shapes a response officer doc to the app-facing fields only', () => {
    expect(toResponseAppProfile(baseOfficer)).toEqual({
      staffId: '652f1a2b3c4d5e6f7a8b9c02',
      name: 'Thabo Mahlangu',
      email: 'thabo@mashtronicsbe.co.za',
      phone: '+27 82 444 5566',
      role: 'Response Officer',
    });
  });

  test('staffId is the stringified _id', () => {
    const out = toResponseAppProfile(baseOfficer);
    expect(typeof out.staffId).toBe('string');
    expect(out.staffId).toBe(String(baseOfficer._id));
  });

  test('never exposes auth linkage or invite fields', () => {
    const out = toResponseAppProfile(baseOfficer);
    expect(out).not.toHaveProperty('supabaseUserId');
    expect(out).not.toHaveProperty('appInviteCode');
    expect(out).not.toHaveProperty('appInviteExpiresAt');
    expect(out).not.toHaveProperty('active');
  });
});
