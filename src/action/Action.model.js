const mongoose = require('mongoose'); 

const status = require.main.require('./src/config/status');

const ActionSchema = new mongoose.Schema({
  isValidFormat: { type: Boolean },
  prefix: { type: String },
  tx: { type: Object },
  txFees: { type: Number },
  txSize: { type: Number },
  txFeePerByte: { type: Number },
  blk: { type: Object },
  payload: { type: Object },
  status: { type: String, default: status.action.code.UNPROCESSED },
}, { timestamps: true });

/**
 * @typedef Action
 */
module.exports = mongoose.model('Action', ActionSchema);
