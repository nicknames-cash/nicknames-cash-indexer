const mongoose = require('mongoose');

const config = require.main.require('./src/config/config');
const status = require.main.require('./src/config/status');
const nicknames = require.main.require('./nicknames.json');

const BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default;
const BITBOX = new BITBOXSDK({
  restURL: config.bitbox.restURL
});

const Block = mongoose.model('Block');

const ActionController = require.main.require('./src/action/action.controller');
const LoggerController = require.main.require('./src/logger/logger.controller');

const logger = LoggerController.logger;

async function start() {
  try {
    await synchronize();
  } catch (e) {
    logger.log('info', 'Failed to synchronize');
    return;
  }
  watchBlockchain();
}

function synchronize() {
  return new Promise(async(resolve, reject) => {
    try {
      let blockToProcess = await getNextBlockToProcess();
      let blockRange = await getBlockRange();

      if (blockRange == 0) {
        resolve();
        return;
      }

      do {
        await processBlock(blockToProcess);
        blockToProcess = await getNextBlockToProcess();
        blockRange = await getBlockRange();
      } while (blockRange > 0)

      logger.log('info', 'Initial synchronization completed.');
      resolve();
    } catch(e) {
      reject(e);
      logger.log('error', 'Failed to get next block to process or block range');
    }
  });
}

/**
 * Gets next block height to process
 */
function getNextBlockToProcess() {
  return new Promise(async(resolve, reject) => {
    try {
      const blockProcessed = await getBestProcessedBlock();
      const blockToProcess = blockProcessed ? blockProcessed.blockHeight + 1 : nicknames.from;
      resolve(blockToProcess);
    } catch(e) {
      reject(e);
      logger.log('error', 'Failed to get best processed block');
    }
  });
}

/**
 * Gets number of unprocessed blocks
 */
function getBlockRange() {
  return new Promise(async(resolve, reject) => {
    let blockHash, block;
    try {
      blockHash = await BITBOX.Blockchain.getBestBlockHash();
      block = await BITBOX.Blockchain.getBlock(blockHash);
    } catch(e) {
      reject(e);
      logger.log('error', 'Failed to retrieve best block hash from BITBOX');
      return;
    }
    const bestBlockHeight = parseInt(block.height);
    const blockProcessed = await getBestProcessedBlock();
    const blockRange = blockProcessed ? bestBlockHeight - blockProcessed.blockHeight : bestBlockHeight - nicknames.from;
    resolve(blockRange);
  });
}

/**
 * Process actions which have been indexed by BitDB
 * @param String block height
 */
function processBlock(blockHeight) {
  return new Promise(async (resolve, reject) => {
    try {
      await ActionController.processActionsFromBlockHeight(blockHeight);
      const processedBlock = new Block({ blockHeight });
      await processedBlock.save();
      resolve();
    } catch(e) {
      logger.log('error', e);
      reject(e);
    }
  });
}

/**
 * Gets the best processed block height
 */
function getBestProcessedBlock() {
  return Block.findOne().sort('-blockHeight').exec();
}

/**
 * Starts sockets to watch for new transactions and blocks
 */
function watchBlockchain() {
  logger.log('info', 'Watching blockchain for new transactions and blocks');
  const actionStream = subscribeActionStream();

  actionStream.onmessage = async (e) => {
    const response = JSON.parse(e.data);
    switch (response.type) {
      case 'mempool':
        let actions = response.data;
        const validatedActions = await ActionController.validateActions(actions, status.action.code.MEMPOOL);
        logger.log('info', `New mempool action: ${validatedActions[0].prefix} in ${validatedActions[0].tx.h}`);
        await ActionController.storeActions(validatedActions);
        break;
      case 'block':
        logger.log('info', `New block detected: ${response.index}`);
        const blockProcessed = await getBestProcessedBlock();
        if (response.index - blockProcessed.blockHeight === 1) {
          processBlock(response.index);
        }
        break;
    }
  }
}

function subscribeActionStream() {
  const EventSource = require('eventsource');
  const query = {
    "v": 3,
    "q": {
      "find": {
        "$or": [
          { "out.h1": nicknames.actions.CLAIM_NICKNAME },
          { "out.h1": nicknames.actions.TRANSFER_NICKNAME },
          { "out.h1": nicknames.actions.RELEASE_NICKNAME }
        ]
      }
    }
  }
  const s = JSON.stringify(query);
  const b64 = Buffer.from(s).toString('base64');
  const bitsocket = new EventSource(config.bitSocket.apiURL + b64);
  return bitsocket;
}

module.exports = {
  start,
};