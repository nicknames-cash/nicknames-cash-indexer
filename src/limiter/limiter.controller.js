const Bottleneck = require('bottleneck');

const config = require.main.require('./src/config/config');

const limiter = new Bottleneck({
  minTime: parseInt(config.bitboxMinTime)
});

module.exports = {
  limiter
}