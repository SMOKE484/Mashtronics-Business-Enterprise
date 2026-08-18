'use strict';
const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  clientRef:     { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  quoteRef:      { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
  jobRef:        { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  subtotal:      { type: Number, required: true },
  vatAmount:     { type: Number, required: true },
  amount:        { type: Number, required: true },
  issuedDate:    { type: Date, required: true },
  dueDate:       { type: Date, required: true },
  status:        { type: String, enum: ['sent', 'paid'], default: 'sent' },
  paidDate:      { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
