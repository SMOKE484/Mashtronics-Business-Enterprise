'use strict';
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  description:  { type: String, required: true },
  qty:          { type: Number, default: 1 },
  supplierCost: { type: Number },
  unitPrice:    { type: Number },
  lineTotal:    { type: Number },
}, { _id: false });

const lineItemSchema = new mongoose.Schema({
  description:  { type: String, required: true },
  detail:       { type: String, default: '' },
  qty:          { type: Number, default: 1 },
  unit:         { type: String, enum: ['Item', 'each', 'm', 'hr', 'Lot', 'Sum', 'N/A'], default: 'Item' },
  unitPrice:    { type: Number, default: 0 },
  discountPct:  { type: Number, default: 0 },
  lineTotal:    { type: Number, default: 0 },
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  items:    [lineItemSchema],
  subtotal: { type: Number, default: 0 },
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  quoteNumber:   { type: String, required: true, unique: true },
  type:          {
    type: String,
    enum: ['package', 'custom_residential', 'residential', 'corporate'],
    required: function () { return this.mode !== 'manual'; },
  },
  mode:          { type: String, enum: ['auto', 'manual'], default: 'auto' },
  packageRef:    { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
  clientRef:     { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  customerName:  { type: String, required: true, trim: true },
  customerPhone: { type: String, required: true, trim: true },
  customerEmail: { type: String, trim: true, lowercase: true },
  site:          { type: String, default: '' },
  scopeOfWork:   { type: String, default: '' },
  quoteDate:     { type: Date, default: Date.now },
  validUntil:    { type: Date },
  preparedBy:    { type: String, default: '' },
  items:         [itemSchema],
  sections:      [sectionSchema],
  subtotal:      { type: Number, required: true },
  installation:  { type: Number, required: true },
  vatAmount:     { type: Number, required: true },
  total:         { type: Number, required: true },
  travelKm:         { type: Number },
  travelRatePerKm:  { type: Number },
  travelSubtotal:   { type: Number, default: 0 },
  travelVAT:        { type: Number, default: 0 },
  travelTotal:      { type: Number, default: 0 },
  status:        { type: String, enum: ['draft', 'sent', 'follow_up_due', 'won', 'lost'], default: 'draft' },
  sentDate:      { type: Date },
  followUpDate:  { type: Date },
  notes:         { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Quote', quoteSchema);
