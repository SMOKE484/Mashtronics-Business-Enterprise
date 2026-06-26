'use strict';
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  description:  { type: String, required: true },
  qty:          { type: Number, default: 1 },
  supplierCost: { type: Number },
  unitPrice:    { type: Number },
  lineTotal:    { type: Number },
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  quoteNumber:   { type: String, required: true, unique: true },
  type:          { type: String, enum: ['package', 'custom_residential', 'residential', 'corporate'], required: true },
  packageRef:    { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
  customerName:  { type: String, required: true, trim: true },
  customerPhone: { type: String, required: true, trim: true },
  customerEmail: { type: String, trim: true, lowercase: true },
  items:         [itemSchema],
  subtotal:      { type: Number, required: true },
  installation:  { type: Number, required: true },
  vatAmount:     { type: Number, required: true },
  total:         { type: Number, required: true },
  travelKm:         { type: Number },
  travelRatePerKm:  { type: Number },
  travelSubtotal:   { type: Number, default: 0 },
  travelVAT:        { type: Number, default: 0 },
  travelTotal:      { type: Number, default: 0 },
  leadStatus:    { type: String, enum: ['new', 'contacted', 'converted'], default: 'new' },
  notes:         { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Quote', quoteSchema);
