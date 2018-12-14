const mongoose = require('mongoose');
const bluebird = require('bluebird');
const debug = require('debug')('express-mongoose-es6-rest-api:index');
const util = require('util');

// require all models
require('./src/nickname/Nickname.model');
require('./src/action/Action.model');
require('./src/indexer/Block.model');

mongoose.Promise = bluebird;

const config = require('./src/config/config');
const indexer = require('./src/indexer/indexer');

// connect to mongo db
const mongoUri = config.mongo.host;
mongoose.connect(mongoUri, { useNewUrlParser: true, useFindAndModify: false });
mongoose.connection.on('error', () => {
  throw new Error(`unable to connect to database: ${mongoUri}`);
});

// print mongoose logs in dev env
if (config.mongooseDebug) {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    debug(`${collectionName}.${method}`, util.inspect(query, false, 20), doc);
  });
}

indexer.start();
