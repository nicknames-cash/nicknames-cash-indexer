const config = require.main.require('./src/config/config');
const status = require.main.require('./src/config/status');
const nicknames = require.main.require('./nicknames.json');
const axios = require('axios');

const BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default;
const BITBOX = new BITBOXSDK({
  restURL: config.bitbox.restURL
});

const LoggerController = require.main.require('./src/logger/logger.controller');
const logger = LoggerController.logger;

let header = {
  headers: { key: config.bitDb.apiKey }
};

/**
 * Get actions from BitDB
 * @param {actionPrefix} String The action prefix to search for
 * @param {blockHeight} String Confine search within a block height
 * @returns {Promise} containing the created search result
 */
function getActionsFromBlockHeight(
  actionPrefix = nicknames.actions.CLAIM_NICKNAME,
  blockHeight = nicknames.from
) {
  // Query BitDB
  return new Promise(async (resolve, reject) => {
    try {
      // Query BitDB for actions with specified prefix and block height
      const actions = await queryAllFromBitDb(actionPrefix, blockHeight);
      resolve(actions);
    } catch(e) {
      logger.log('error', e);
      reject(e);
    }
  });
}

async function queryAllFromBitDb(
  actionPrefix = nicknames.actions.CLAIM_NICKNAME,
  blockHeight = nicknames.from
) {
  try {
    let actions = [];
    let page = 1;
    let response = await queryBitDb(actionPrefix, blockHeight, page);
    do {
      actions = [...actions, ...response];
      page++;
      response = await queryBitDb(actionPrefix, blockHeight, page);
    } while (response.length > 0)
    return actions;
  } catch (e) {
    logger.log('error', e);
  }
}

/**
 * Get actions from BitDB
 * @param {actionPrefix} String The action prefix to search for
 * @param {actionPrefix} Array An array of action prefix strings
 * @param {blockHeight} String Confine search within a block height
 * @returns {Array} containing the created search result
 */
async function queryBitDb(
  actionPrefix = nicknames.actions.CLAIM_NICKNAME,
  blockHeight = nicknames.from,
  page = 1
) {
  let findCriteria = {
    "blk.i": blockHeight,
    "out.h1": actionPrefix
  };

  // Construct query for an array of action prefixes
  if (Array.isArray(actionPrefix)) {
    let criteria = actionPrefix.map(prefix => {
      return {
        "blk.i": blockHeight,
        "out.h1": prefix,
      }
    });
    findCriteria = {
      "$or": criteria
    }
  }

  let query = {
    "v": 3,
    "q": {
      "find": findCriteria,
      "limit": 100,
      "skip": 100 * (page - 1)
    }
  };

  let s = JSON.stringify(query);
  let b64 = Buffer.from(s).toString('base64');
  let url = config.bitDb.restURL + b64;

  let bitDbResult, actions;

  try {
    bitDbResult = await axios.get(url, header);
  } catch (e) {
    logger.log('error', 'Failed to retrieve result from BitDB API');
  }

  if (bitDbResult) {
    actions = bitDbResult.data.c;
  }

  // Query for transaction index
  let block;
  try {
    block = await BITBOX.Block.details(blockHeight);
  } catch (e) {
    logger.log('error', 'Failed to retrieve block info from BITBOX');
  }

  if (bitDbResult && block) {
    let tx = block.tx;
    return actions.map(action => {
      action.tx.i = tx.indexOf(action.tx.h);
      return action;
    });
  } else {
    throw new Error('Failed to query BitDB');
  }
}

module.exports = {
  getActionsFromBlockHeight
}