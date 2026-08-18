'use strict';
const { deriveInvoiceStatus } = require('./invoices');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function r2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Headline dashboard KPIs, computed live from Invoice/Job/Technician records.
 * Never stored — always derived so they can't drift from the underlying data.
 */
function computeKPIs({ invoices = [], jobs = [], technicians = [] }, today = new Date()) {
  const currentYear = new Date(today).getFullYear();

  const totalInvoiced = r2(invoices.reduce((sum, inv) => sum + inv.amount, 0));
  const currentYearRevenue = r2(
    invoices
      .filter(inv => new Date(inv.issuedDate).getFullYear() === currentYear)
      .reduce((sum, inv) => sum + inv.amount, 0)
  );
  const outstandingTotal = r2(
    invoices
      .filter(inv => deriveInvoiceStatus(inv, today) === 'overdue')
      .reduce((sum, inv) => sum + inv.amount, 0)
  );
  const activeJobsCount = jobs.filter(j => j.status !== 'Completed' && j.status !== 'Cancelled').length;
  const technicianCount = technicians.filter(t => t.active).length;

  return { totalInvoiced, currentYearRevenue, outstandingTotal, activeJobsCount, technicianCount };
}

/**
 * Groups invoices by the calendar year of their issue date. Sorted ascending.
 */
function revenueByYear(invoices = []) {
  const byYear = new Map();
  for (const inv of invoices) {
    const year = new Date(inv.issuedDate).getFullYear();
    byYear.set(year, r2((byYear.get(year) || 0) + inv.amount));
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, revenue]) => ({ year, revenue }));
}

function relativeTime(date, today) {
  const days = Math.floor((today - new Date(date)) / MS_PER_DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatEvent(event) {
  switch (event.type) {
    case 'invoice_paid':    return `Invoice ${event.invoiceNumber} paid by ${event.clientName}`;
    case 'invoice_overdue': return `Invoice ${event.invoiceNumber} to ${event.clientName} is ${event.daysOverdue} day${event.daysOverdue === 1 ? '' : 's'} overdue`;
    case 'invoice_sent':    return `Invoice ${event.invoiceNumber} sent to ${event.clientName}`;
    case 'quote_sent':      return `Quote sent to ${event.clientName}`;
    case 'quote_won':       return `Quote won — ${event.clientName}`;
    case 'job_completed':   return `Job completed — ${event.site || event.clientName}`;
    case 'compliance_alert': return `${event.name} ${event.status === 'Expired' ? 'has expired' : `expiring in ${event.daysRemaining} day${event.daysRemaining === 1 ? '' : 's'}`}`;
    default: return event.title || '';
  }
}

/**
 * Synthesizes a "recent activity" feed from already-fetched records' updatedAt
 * timestamps — no dedicated activity-log collection.
 */
function buildRecentActivity(events = [], today = new Date(), limit = 5) {
  return events
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, limit)
    .map(e => ({ title: formatEvent(e), time: relativeTime(e.updatedAt, today) }));
}

module.exports = { computeKPIs, revenueByYear, buildRecentActivity };
