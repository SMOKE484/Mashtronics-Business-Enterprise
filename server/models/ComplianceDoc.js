'use strict';
const mongoose = require('mongoose');

const complianceDocSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  issuedDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  notes:      { type: String, default: '' },
  active:     { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('ComplianceDoc', complianceDocSchema);
