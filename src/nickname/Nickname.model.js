const mongoose = require('mongoose'); 

const config = require.main.require('./src/config/config');
const status = require.main.require('./src/config/status');

const NicknameSchema = new mongoose.Schema({
  nickname: { type: String },
  fullname: { type: String },
  avatar: { type: String },
  addressLegacy: { type: String },
  address: { type: String },
  status: { type: String }
}, { timestamps: true });

/**
 * @typedef Nickname
 */
module.exports = mongoose.model('Nickname', NicknameSchema);
