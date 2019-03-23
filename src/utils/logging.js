const pino = require('pino');

let level = process.env.CRYPTOACCOUNTING_LOGLEVEL || process.env.CRYPTOACCOUNTING_LOGLEVEL || 'info';

let LOGGER = pino({
  application: 'apiserver',
  level: level.toLowerCase(),
});

function getLogger(module) {
  return LOGGER.child({ module });
}

function setLogger(logger) {
  LOGGER = logger;
  LOGGER.warn('Set custom logger');
  return LOGGER;
}

module.exports = {
  setLogger: setLogger,
  get: getLogger,
};
