'use strict';
const mongoose = require('mongoose');

const maintenanceContractSchema = new mongoose.Schema({
  clientRef:     { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  service:       { type: String, required: true, trim: true },
  frequency:     { type: String, required: true, trim: true },
  contractSince: { type: Date, required: true },
  nextVisit:     { type: Date, required: true },
  active:        { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('MaintenanceContract', maintenanceContractSchema);
