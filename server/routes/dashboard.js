'use strict';
const express          = require('express');
const Client           = require('../models/Client');
const Invoice          = require('../models/Invoice');
const Job              = require('../models/Job');
const Quote            = require('../models/Quote');
const Technician       = require('../models/Technician');
const ComplianceDoc    = require('../models/ComplianceDoc');
const DahuaPendingBind = require('../models/DahuaPendingBind');
const { requireAuth }  = require('../middleware/auth');
const { deriveInvoiceStatus }     = require('../services/invoices');
const { deriveComplianceStatus }  = require('../services/compliance');
const { computeKPIs, revenueByYear, buildRecentActivity } = require('../services/dashboard');
const { computeClientRevenue } = require('../services/clients');

const router = express.Router();
router.use(requireAuth);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// GET /api/dashboard/summary
async function summaryHandler(req, res) {
  try {
    const today = new Date();
    const [clients, invoices, jobs, quotes, technicians, complianceDocs, dahuaPendingBinds] = await Promise.all([
      Client.find({ archived: false }),
      Invoice.find().populate('clientRef', 'name'),
      Job.find(),
      Quote.find().populate('clientRef', 'name'),
      Technician.find(),
      ComplianceDoc.find({ active: true }),
      DahuaPendingBind.find({ status: 'pending' }).sort({ receivedAt: -1 }).limit(5),
    ]);
    const dahuaPendingBindsCount = await DahuaPendingBind.countDocuments({ status: 'pending' });

    const kpis = computeKPIs({ invoices, jobs, technicians }, today);
    const revenueBars = revenueByYear(invoices);

    const revenueMap = computeClientRevenue(invoices);
    const topClients = clients
      .map(c => ({ _id: c._id, name: c.name, ...(revenueMap.get(String(c._id)) || { totalInvoiced: 0, invoiceCount: 0, largestInvoice: 0 }) }))
      .filter(c => c.totalInvoiced > 0)
      .sort((a, b) => b.totalInvoiced - a.totalInvoiced);

    const complianceAlerts = complianceDocs
      .map(d => ({ _id: d._id, name: d.name, expiryDate: d.expiryDate, ...deriveComplianceStatus(d.expiryDate, today) }))
      .filter(d => d.status !== 'Valid')
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    const events = [];
    for (const inv of invoices) {
      const clientName = inv.clientRef && inv.clientRef.name;
      const derived = deriveInvoiceStatus(inv, today);
      if (derived === 'paid') {
        events.push({ type: 'invoice_paid', invoiceNumber: inv.invoiceNumber, clientName, updatedAt: inv.paidDate || inv.updatedAt });
      } else if (derived === 'overdue') {
        const daysOverdue = Math.floor((today - new Date(inv.dueDate)) / MS_PER_DAY);
        events.push({ type: 'invoice_overdue', invoiceNumber: inv.invoiceNumber, clientName, daysOverdue, updatedAt: inv.updatedAt });
      } else {
        events.push({ type: 'invoice_sent', invoiceNumber: inv.invoiceNumber, clientName, updatedAt: inv.updatedAt });
      }
    }
    for (const q of quotes) {
      const clientName = (q.clientRef && q.clientRef.name) || q.customerName;
      if (q.status === 'sent') events.push({ type: 'quote_sent', clientName, updatedAt: q.sentDate || q.updatedAt });
      if (q.status === 'won') events.push({ type: 'quote_won', clientName, updatedAt: q.updatedAt });
    }
    for (const j of jobs) {
      if (j.status === 'Completed') events.push({ type: 'job_completed', site: j.site, updatedAt: j.updatedAt });
    }
    for (const alert of complianceAlerts) {
      events.push({ type: 'compliance_alert', name: alert.name, status: alert.status, daysRemaining: alert.daysRemaining, updatedAt: alert.expiryDate });
    }

    const recentActivity = buildRecentActivity(events, today, 5);

    res.json({ kpis, revenueByYear: revenueBars, topClients, complianceAlerts, recentActivity, dahuaPendingBinds, dahuaPendingBindsCount });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
router.get('/summary', summaryHandler);

module.exports = router;
module.exports.summaryHandler = summaryHandler;
