'use strict';
jest.mock('../models/Client', () => ({ find: jest.fn() }));
jest.mock('../models/Invoice', () => ({ find: jest.fn() }));
jest.mock('../models/Job', () => ({ find: jest.fn() }));
jest.mock('../models/Quote', () => ({ find: jest.fn() }));
jest.mock('../models/Technician', () => ({ find: jest.fn() }));
jest.mock('../models/ComplianceDoc', () => ({ find: jest.fn() }));
jest.mock('../models/DahuaPendingBind', () => ({ find: jest.fn(), countDocuments: jest.fn() }));

const { computeKPIs, revenueByYear, buildRecentActivity } = require('../services/dashboard');
const Client            = require('../models/Client');
const Invoice           = require('../models/Invoice');
const Job               = require('../models/Job');
const Quote             = require('../models/Quote');
const Technician        = require('../models/Technician');
const ComplianceDoc     = require('../models/ComplianceDoc');
const DahuaPendingBind  = require('../models/DahuaPendingBind');
const { summaryHandler } = require('../routes/dashboard');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('computeKPIs', () => {
  const today = new Date('2026-07-09T00:00:00Z');
  const invoices = [
    { amount: 100000, issuedDate: '2026-01-10', status: 'paid', dueDate: '2026-02-10' },
    { amount: 50000, issuedDate: '2025-06-01', status: 'sent', dueDate: '2025-07-01' }, // overdue
    { amount: 20000, issuedDate: '2026-06-01', status: 'sent', dueDate: '2026-08-01' }, // not due yet
  ];
  const jobs = [
    { status: 'Scheduled' },
    { status: 'In Progress' },
    { status: 'Completed' },
    { status: 'Cancelled' },
  ];
  const technicians = [{ active: true }, { active: true }, { active: false }];

  test('totalInvoiced sums every invoice regardless of status', () => {
    const r = computeKPIs({ invoices, jobs, technicians }, today);
    expect(r.totalInvoiced).toBe(170000);
  });

  test('currentYearRevenue only counts invoices issued in the current calendar year', () => {
    const r = computeKPIs({ invoices, jobs, technicians }, today);
    expect(r.currentYearRevenue).toBe(120000);
  });

  test('outstandingTotal only counts overdue (sent + past due date) invoices', () => {
    const r = computeKPIs({ invoices, jobs, technicians }, today);
    expect(r.outstandingTotal).toBe(50000);
  });

  test('activeJobsCount excludes Completed and Cancelled', () => {
    const r = computeKPIs({ invoices, jobs, technicians }, today);
    expect(r.activeJobsCount).toBe(2);
  });

  test('technicianCount only counts active technicians', () => {
    const r = computeKPIs({ invoices, jobs, technicians }, today);
    expect(r.technicianCount).toBe(2);
  });

  test('empty inputs produce all zeros', () => {
    const r = computeKPIs({ invoices: [], jobs: [], technicians: [] }, today);
    expect(r).toEqual({ totalInvoiced: 0, currentYearRevenue: 0, outstandingTotal: 0, activeJobsCount: 0, technicianCount: 0 });
  });
});

describe('revenueByYear', () => {
  test('groups and sums by calendar year of issuedDate, sorted ascending', () => {
    const r = revenueByYear([
      { amount: 100, issuedDate: '2024-03-01' },
      { amount: 50, issuedDate: '2022-01-01' },
      { amount: 25, issuedDate: '2024-11-01' },
    ]);
    expect(r).toEqual([
      { year: 2022, revenue: 50 },
      { year: 2024, revenue: 125 },
    ]);
  });

  test('empty invoices produces an empty array', () => {
    expect(revenueByYear([])).toEqual([]);
  });
});

describe('buildRecentActivity', () => {
  const today = new Date('2026-07-09T00:00:00Z');

  test('sorts events by most recent updatedAt and formats titles', () => {
    const events = [
      { type: 'quote_sent', clientName: 'Rand Water', updatedAt: '2026-07-06T00:00:00Z' },
      { type: 'invoice_paid', invoiceNumber: 'INV-1', clientName: 'STLM', updatedAt: '2026-07-07T00:00:00Z' },
      { type: 'job_completed', site: 'Bryanston Campus', updatedAt: '2026-07-03T00:00:00Z' },
    ];
    const r = buildRecentActivity(events, today, 5);
    expect(r.map(e => e.title)).toEqual([
      'Invoice INV-1 paid by STLM',
      'Quote sent to Rand Water',
      'Job completed — Bryanston Campus',
    ]);
  });

  test('respects the limit', () => {
    const events = [
      { type: 'quote_sent', clientName: 'A', updatedAt: '2026-07-01' },
      { type: 'quote_sent', clientName: 'B', updatedAt: '2026-07-02' },
      { type: 'quote_sent', clientName: 'C', updatedAt: '2026-07-03' },
    ];
    expect(buildRecentActivity(events, today, 2)).toHaveLength(2);
  });

  test('relative time labels: today, 1 day ago, N days ago', () => {
    const events = [
      { type: 'quote_sent', clientName: 'Today', updatedAt: '2026-07-09T00:00:00Z' },
      { type: 'quote_sent', clientName: 'Yesterday', updatedAt: '2026-07-08T00:00:00Z' },
      { type: 'quote_sent', clientName: 'ThreeDaysAgo', updatedAt: '2026-07-06T00:00:00Z' },
    ];
    const r = buildRecentActivity(events, today, 5);
    expect(r.map(e => e.time)).toEqual(['Today', '1 day ago', '3 days ago']);
  });
});

describe('GET /api/dashboard/summary — dahuaPendingBinds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Client.find.mockResolvedValue([]);
    Invoice.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
    Job.find.mockResolvedValue([]);
    Quote.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
    Technician.find.mockResolvedValue([]);
    ComplianceDoc.find.mockResolvedValue([]);
  });

  test('includes the pending-bind preview list and total count', async () => {
    const preview = [{ _id: 'pb1', deviceSerial: 'SN1' }];
    DahuaPendingBind.find.mockReturnValue({ sort: jest.fn(() => ({ limit: jest.fn().mockResolvedValue(preview) })) });
    DahuaPendingBind.countDocuments.mockResolvedValue(3);

    const res = mockRes();
    await summaryHandler({}, res);

    expect(DahuaPendingBind.find).toHaveBeenCalledWith({ status: 'pending' });
    expect(DahuaPendingBind.countDocuments).toHaveBeenCalledWith({ status: 'pending' });
    const body = res.json.mock.calls[0][0];
    expect(body.dahuaPendingBinds).toEqual(preview);
    expect(body.dahuaPendingBindsCount).toBe(3);
  });

  test('a downstream error still 500s with a friendly message', async () => {
    DahuaPendingBind.find.mockReturnValue({ sort: jest.fn(() => ({ limit: jest.fn().mockRejectedValue(new Error('mongo down')) })) });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = mockRes();
    await summaryHandler({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    errSpy.mockRestore();
  });
});
