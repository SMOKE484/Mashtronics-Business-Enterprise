'use strict';
const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  description:  { type: String, default: '' },
  cameraCount:  { type: Number },
  priceInclVAT: { type: Number, required: true },
  category:     { type: String, enum: ['residential', 'corporate'], required: true },
  active:       { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);
