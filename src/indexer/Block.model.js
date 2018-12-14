const mongoose = require('mongoose'); 

const BlockSchema = new mongoose.Schema({
  blockHeight: { type: Number },
  status: { type: String },
  indexTime: { type: Date, default: Date.now }
}, { timestamps: true });

/**
 * @typedef Block
 */
module.exports = mongoose.model('Block', BlockSchema);
