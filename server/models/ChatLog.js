'use strict';
const mongoose = require('mongoose');

const chatLogSchema = new mongoose.Schema({
  question: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('ChatLog', chatLogSchema);
