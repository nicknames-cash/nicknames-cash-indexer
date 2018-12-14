// require and configure dotenv, will load vars in .env in PROCESS.ENV
require('dotenv').config();

const config = {
  bitbox: {
    restURL: process.env.BITBOX_REST_URL
  },
  bitDb: {
    restURL: process.env.BITDB_REST_URL,
    apiKey: process.env.BITDB_API_KEY,
    encoding: {
      CLAIM_NICKNAME: { "out.b1": "hex" },
      TRANSFER_NICKNAME: { "out.b1": "hex", "out.b3": "hex" },
      RELEASE_NICKNAME: { "out.b1": "hex" }
    }
  },
  bitSocket: {
    apiURL: process.env.BITSOCKET_API_URL
  },
  bitboxMinTime: process.env.BITBOX_MIN_TIME,
  firstBlock: process.env.FIRST_BLOCK,
  txBatchChunks: parseInt(process.env.TX_BATCH_CHUNKS),
  env: process.env.NODE_ENV,
  mongooseDebug: process.env.MONGOOSE_DEBUG,
  mongo: {
    host: process.env.MONGO_HOST,
    port: process.env.MONGO_PORT,
  },
  actions: {
    CLAIM_NICKNAME: '0ff7087b01',
    TRANSFER_NICKNAME: '0ff7087b02',
    RELEASE_NICKNAME: '0ff7087b03',
    SET_AVATAR: '0ff7087b04',
    SET_FULLNAME: '0ff7087b05'
  },
};

module.exports = config;
