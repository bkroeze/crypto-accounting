import pino from 'pino';

const level = process.env.CRYPTOACCOUNTING_LOGLEVEL || process.env.CRYPTOACCOUNTING_LOGLEVEL || 'info';

let LOGGER = pino({
  application: 'apiserver',
  level: level.toLowerCase(),
});

export function get(module) {
  return LOGGER.child({ module });
}

export function setLogger(logger) {
  LOGGER = logger;
  LOGGER.warn('Set custom logger');
  return LOGGER;
}
