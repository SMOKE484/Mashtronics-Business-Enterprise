'use strict';
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  clientRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  sender:     { type: String, enum: ['client', 'admin', 'ai', 'system'], required: true },
  senderName: { type: String, default: '', trim: true },
  text:       { type: String, required: true, trim: true },
  readByAdmin: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
