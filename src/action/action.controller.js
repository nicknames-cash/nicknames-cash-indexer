const mongoose = require('mongoose');
const bluebird = require('bluebird');
const { forEach, map } = require('p-iteration');

const config = require.main.require('./src/config/config');
const nicknames = require.main.require('./nicknames.json');

const BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default;
const BITBOX = new BITBOXSDK({
  restURL: config.bitbox.restURL
});

const Action = mongoose.model('Action');
const Nickname = mongoose.model('Nickname');

const status = require.main.require('./src/config/status');

const NicknameController = require.main.require('./src/nickname/nickname.controller');
const LoggerController = require.main.require('./src/logger/logger.controller');
const BitDBController = require.main.require('./src/bitdb/bitdb.controller');

const logger = LoggerController.logger;

mongoose.Promise = bluebird;

/**
 * Process action.
 * @param Action
 */
function process(action) {
  return () => {
    switch (action.prefix) {
      case nicknames.actions.CLAIM_NICKNAME:
        return processClaimNickname(action);
      case nicknames.actions.TRANSFER_NICKNAME:
        return processTransferNickname(action);
      case nicknames.actions.RELEASE_NICKNAME:
        return processReleaseNickname(action);
      case nicknames.actions.SET_AVATAR:
        break;
      case nicknames.actions.SET_FULLNAME:
        break;
    }
  }
}

/**
 * Process CLAIM_NICKNAME
 * @param Action
 * @returns Promise
 */
function processClaimNickname(action) {
  const { nickname, actor } = action.payload;

  return new Promise(async(resolve, reject) => {
    try {
      // Reject action if nickname is unavailable
      const isNicknameAvailable = await NicknameController.checkNicknameAvailability(nickname);
      if (!isNicknameAvailable) {
        logger.log('info', `${nickname} is unavailable for claim by ${actor} in tx ${action.tx.h}`);
        action.status = status.action.code.REJECTED_CLAIM_EXISTING;
        await action.save();
        resolve(action);
        return false;
      }

      // Reject action if address already has a nickname
      const isAddressAvailable = await NicknameController.checkAddressAvailability(actor);
      if (!isAddressAvailable) {
        logger.log('info', `${actor} already has a nickname attached to it. Failed to claim ${nickname} in tx ${action.tx.h}`);
        action.status = status.action.code.REJECTED_CLAIM_ADDRESS_UNAVAILABLE;
        await action.save();
        resolve(action);
        return false;
      }

      // Accept action
      await NicknameController.setNicknameAddress(nickname, actor);
      action.status = status.action.code.ACCEPTED;
      await action.save();

      // Check for other conflicting actions in this block and reject them
      const clashingActionsParameters = {
        prefix: action.prefix,
        'blk.i': action.blk.i,
        payload: action.payload,
        status: status.action.code.UNPROCESSED,
        isValidFormat: true
      };

      const clashingActions = await Action.find(clashingActionsParameters).exec();
      if (clashingActions && clashingActions.length > 1) {
        await forEach(clashingActions, async (clashingAction) => {
          // Reject claim if action is not the action with highest fee
          if (clashingAction.txFeePerByte < action.txFeePerByte) {
            logger.log('info', `${clashingAction.payload.actor} failed to claim ${clashingAction.payload.nickname} in tx ${clashingAction.tx.h} due to low fee`);
            clashingAction.status = status.action.code.REJECTED_CLAIM_FEE_LOST;
            await clashingAction.save();
            resolve();
            return;
          }
          // Reject claim if action has a higher index in the block
          else if (clashingAction.txFeePerByte == action.txFeePerByte && clashingAction.tx.i > action.tx.i) {
            logger.log('info', `${clashingAction.payload.actor} failed to claim ${clashingAction.payload.nickname} in tx ${clashingAction.tx.h} due to tx order being of lesser priority`);
            clashingAction.status = status.action.code.REJECTED_CLAIM_INDEX_LOST;
            await clashingAction.save();
            resolve();
            return;
          }
        });
      }

      // Resolve with action
      resolve(action);
    } catch(e) {
      logger.log('error', e);
      reject(e);
    }
  });
}

/**
 * Process TRANSFER_NICKNAME
 * @param Action
 * @returns Promise
 */
function processTransferNickname(action) {
  return new Promise(async(resolve, reject) => {
    const nickname = await Nickname.findOne({ address: action.payload.actor }).exec();
  
    // Reject action if actor does not have any nicknames
    if (!nickname) {
      logger.log('info', `${action.payload.actor} has no nicknames to transfer in ${action.tx.h}.`);
      action.status = status.action.code.REJECTED_INVALID_NICKNAME;
      action.save();
      resolve();
      return;
    }

    // Reject action if recipient already has an address attached to it.
    let isRecipientAddressAvailable = NicknameController.checkAddressAvailability(action.payload.address);
    if (!isRecipientAddressAvailable) {
      logger.log('info', `${action.payload.actor} failed to transfer ${nickname.nickname} in tx ${action.tx.h} because recipient already has a nickname.`);
      action.status = status.action.code.REJECTED_TRANSFER_RECIPIENT_UNAVAILABLE;
      action.save();
      resolve();
      return;
    }

    // Accept action
    logger.log('info', `${action.payload.actor} successfully transferred ${nickname.nickname} to ${action.payload.address} in tx ${action.tx.h}`);
    await NicknameController.setNicknameAddress(nickname.nickname, action.payload.address);
    action.status = status.action.code.ACCEPTED;
    await action.save();

    // Check for other conflicting transfers made by the same address in this block and reject them
    const clashingActionsParameters = {
      prefix: action.prefix,
      'blk.i': action.blk.i,
      'payload.actor': action.payload.actor,
      status: status.action.code.UNPROCESSED,
      isValidFormat: true
    };

    const clashingActions = await Action.find(clashingActionsParameters).exec();

    if (clashingActions && clashingActions.length > 1) {
      // Reject other transfers
      await forEach(clashingActions, async (clashingAction) => {
        clashingAction.status = status.action.code.REJECTED_TRANSFER_FEE_LOST;
        await clashingAction.save();
      });
    }

    resolve(action);
  });
}

/**
 * Process RELEASE_NICKNAME
 * @param Action
 * @returns Promise
 */
function processReleaseNickname(action) {
  return new Promise(async(resolve, reject) => {
    const nickname = await Nickname.findOne({ nickname: action.payload.actor }).exec();
  
    // Nickname does not exist. Do not proceed.
    if (!nickname) {
      logger.log('info', `${action.payload.actor} failed to release nickname in tx ${action.tx.h} due invalid nickname`);
      action.status = status.action.code.REJECTED_INVALID_NICKNAME;
      action.save();
      resolve();
      return;
    }

    // Accept action
    logger.log('info', `${action.payload.actor} successfully released ${nickname.nickname} in tx ${action.tx.h}`);
    await NicknameController.releaseNickname(action.payload.nickname);
    action.status = status.action.code.ACCEPTED;
    action.save();
    resolve(action);

    // Check for multiple releases affecting this nickname
    const clashingActionsParameters = {
      prefix: action.prefix,
      'blk.i': action.blk.i,
      'payload.actor': action.payload.actor,
      status: status.action.code.UNPROCESSED,
      isValidFormat: true
    };

    const clashingActions = await Action.find(clashingActionsParameters).exec();

    if (clashingActions && clashingActions.length > 1) {
      // Reject other releases
      forEach(clashingActions, async (clashingAction) => {
        clashingAction.status = status.action.code.REJECTED_RELEASE_FEE_LOST;
        await clashingAction.save();
      });
    }
  });
}

/**
 * Query BitDB and process actions from block height
 * @param String block height
 */
function processActionsFromBlockHeight(blockHeight) {
  return new Promise(async (resolve, reject) => {
    try {
      // Query BitDB for all nicknames.cash transactions which are present in a block
      logger.log('info', `Processing ${blockHeight}`);
      await getAndStoreActions(nicknames.actions.CLAIM_NICKNAME, blockHeight);
      await getAndStoreActions(nicknames.actions.TRANSFER_NICKNAME, blockHeight);
      await getAndStoreActions(nicknames.actions.RELEASE_NICKNAME, blockHeight);

      const allActions = await getAllUnprocessedActionsFromBlockHeight(blockHeight);

      // Processing is done sequentially in decreasing order for txFeePerByte,
      // and increasing order in tx index
      let allActionsToProcess = [];
      allActions.forEach(async action => allActionsToProcess.push(process(action)));
      await bluebird.mapSeries(allActionsToProcess, asyncMethodPassed => asyncMethodPassed());
      if (allActions.length > 0) {
        logger.log('info', `Completed processing of actions in ${blockHeight}`);
      } else {
        logger.log('info', `No actions in ${blockHeight}`);
      }

      resolve();
    } catch(e) {
      logger.log('error', e);
      reject(e);
    }
  });
}

/**
 * Get actions from BitDB and store them into our database
 * @param String block height
 */
async function getAndStoreActions(
  actionPrefix = nicknames.actions.CLAIM_NICKNAME,
  blockHeight = nicknames.from
) {
  try {
    const actions = await BitDBController.getActionsFromBlockHeight(actionPrefix, blockHeight);
    const validatedActions = await validateActions(actions);
    await storeActions(validatedActions);
    return getUnprocessedActionsFromBlockHeight(actionPrefix, blockHeight);
  } catch(e) {
    logger.log('error', e);
  }
}

/**
 * Store actions from BitDB into our database
 * @param String block height
 */
function storeActions(actions) {
  return forEach(actions, async (action) => {
    try {
      return await Action.findOneAndUpdate(
        { tx: action.tx },
        action,
        { upsert: true, setDefaultsOnInsert: true }
      ).exec();
    } catch(e) {
      logger.log('error', e);
    }
  });
}

/**
 * Query DB for unprocessed actions from a specific block height
 * @param Number block height
 */
function getUnprocessedActionsFromBlockHeight(
  actionPrefix = nicknames.actions.CLAIM_NICKNAME,
  blockHeight = nicknames.from
) {
  return Action.find({
    'blk.i': blockHeight,
    'prefix': actionPrefix,
    'status': status.action.code.UNPROCESSED,
    'isValidFormat': true
  })
  .sort({ txFeePerByte: -1, 'tx.i': 1 })
  .exec();
}

/**
 * Query DB for ALL unprocessed actions from a specific block height
 * @param Number block height
 */
function getAllUnprocessedActionsFromBlockHeight(blockHeight = nicknames.from) {
  return Action.find({
    'blk.i': blockHeight,
    'status': status.action.code.UNPROCESSED,
    'isValidFormat': true
  })
  .sort({ txFeePerByte: -1, 'tx.i': 1 })
  .exec();
}

/**
 * Receives an input of array of BitDB transactions, validates them,
 * and returns an array of actions along with its validity status
 * (Valid if it has 1 input, 2 outputs, where output with index 1 is an OP_RETURN)
 * @param {transactions} Array of transactions
 * @returns {actions} Array of validated actions
 */
function validateActions(transactions, actionStatus = status.action.code.UNPROCESSED) {
  let actions = map(transactions, async transaction => {
    let action = await validateAction(transaction, actionStatus);
    return action;
  });
  return actions;
}

/**
 * Converts a transaction from BitDB into a nicknames.cash action
 * and validate the action format
 * @param {transaction} Object A transaction from BitDB
 * @returns {action} A nicknames.cash action
 */
async function validateAction(transaction, actionStatus = status.action.code.UNPROCESSED) {
  let txDetails = await BITBOX.Transaction.details(transaction.tx.h);
  let action = {
    isValidFormat: transaction.in.length == 1 && transaction.out.length == 2 && transaction.out[1].b0.op == 106,
    prefix: transaction.out[1].h1,
    tx: transaction.tx,
    txFees: txDetails.fees,
    txSize: txDetails.size,
    txFeePerByte: txDetails.fees / txDetails.size,
    blk: transaction.blk,
    payload: {
      actor: BITBOX.Address.toCashAddress(transaction.in[0].e.a),
      actorLegacy: BITBOX.Address.toLegacyAddress(transaction.in[0].e.a),
    },
    status: actionStatus
  }

  switch (action.prefix) {
    case nicknames.actions.CLAIM_NICKNAME:
      action.payload.nickname = transaction.out[1].s2;
      if (transaction.out[1].s2 === undefined || transaction.out[1].s2 === null) action.isValidFormat = false;
      break;
    case nicknames.actions.TRANSFER_NICKNAME:
      if (transaction.out[1].h2 === undefined || transaction.out[1].h2 === null) action.isValidFormat = false;
      try {
        const isHash160 = BITBOX.Address.isHash160(transaction.out[1].h2);
        action.isValidFormat = isHash160;
        action.payload.address = BITBOX.Address.hash160ToCash(transaction.out[1].h2);
        action.payload.addressLegacy = BITBOX.Address.hash160ToLegacy(transaction.out[1].h2);
      } catch(e) {
        action.isValidFormat = false;
      }
      break;
    case nicknames.actions.RELEASE_NICKNAME:
      break;
    case nicknames.actions.SET_AVATAR:
      break;
    case nicknames.actions.SET_FULLNAME:
      break;
  }

  if (!action.isValidFormat) action.status = status.action.code.REJECTED_INVALID_FORMAT;

  return action;
}

module.exports = {
  processActionsFromBlockHeight, validateActions, validateAction, storeActions
};
