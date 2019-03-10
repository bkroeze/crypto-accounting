const pino = require('pino');

let level = process.env.CRYPTOACCOUNTING_LOGLEVEL || process.env.CRYPTOACCOUNTING_LOGLEVEL || 'info';
let LOGGER = pino({
  application: 'apiserver',
  level: pino.levels.values[level.toLowerCase()],
});

function getLogger(module) {
  return LOGGER.child({ module });
}

function setLogger(logger) {
  LOGGER = logger;
  return LOGGER;
}

module.exports = {
  setLogger: setLogger,
  get: getLogger,
};
