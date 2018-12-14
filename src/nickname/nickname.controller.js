const mongoose = require('mongoose');

const config = require.main.require('./src/config/config');

const BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default;
const BITBOX = new BITBOXSDK({
  restURL: config.bitbox.restURL
});

const status = require.main.require('./src/config/status');

const Nickname = mongoose.model('Nickname');

const LoggerController = require.main.require('./src/logger/logger.controller');
const logger = LoggerController.logger;

/**
 * Sets an address for a nickname
 * @param {String} nickname
 * @param {String} address
 * @returns {User}
 */
function setNicknameAddress(nickname, address) {
  return new Promise((resolve, reject) => {
    let addressLegacy = BITBOX.Address.toLegacyAddress(address);
    Nickname.findOneAndUpdate(
      { nickname },
      { nickname, address, addressLegacy, status: status.nickname.code.CLAIMED },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).then(savedNickname => {
      logger.log('info', `Successfully set nickname for ${address} to ${savedNickname.nickname}`);
      resolve(savedNickname);
    })
    .catch(e => reject(e));
  });
}

/**
 * Releases a nickname
 * @param {String} nickname
 * @returns {User}
 */
function releaseNickname(nickname) {
  return new Promise((resolve, reject) => {
    Nickname.findOneAndUpdate(
      { nickname },
      { nickname, address: '', addressLegacy: '', status: status.nickname.code.AVAILABLE },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).then(savedNickname => {
      logger.log('info', `Successfully released nickname ${savedNickname.nickname}`);
      resolve(savedNickname);
    })
    .catch(e => reject(e));
  });
}

/**
 * Check nickname availability
 * @param String
 * @returns Boolean
 */
async function checkNicknameAvailability(nickname) {
  return new Promise(async (resolve, reject) => {
    try {
      const nicknameResult = await Nickname.findOne({ nickname }).exec();
      if (!nicknameResult) {
        resolve(true);
        return;
      }
      resolve(nicknameResult.status == status.nickname.code.AVAILABLE);
    } catch(e) {
      logger.log('error', 'Failed to retrieve nickname from database', { nickname, e });
      reject(e);
    }
  });
}

/**
 * Check if an address already has a nickname attached to it
 * @param String
 * @returns Boolean
 */
async function checkAddressAvailability(address) {
  return new Promise(async (resolve, reject) => {
    try {
      const addressCashAddress = BITBOX.Address.toCashAddress(address);
      const nicknameResult = await Nickname.findOne({ address: addressCashAddress }).exec();
      if (!nicknameResult) {
        resolve(true);
        return;
      }
      resolve(false);
    } catch(e) {
      logger.log('error', 'Failed to retrieve nickname from database', { nickname, e });
      reject(e);
    }
  });
}

module.exports = {
  checkNicknameAvailability, setNicknameAddress, releaseNickname, checkAddressAvailability
};
