var r = require('ramda');

/**
 * Gets a value from the process environment, taking into account any
 * environment overrides, in the form of key_ENV.
 * @param {String} key for environment variable
 * @param {Any} default value to return if not found
 * @return {String|Any} value from process, else default
 */
function getVal(key, defaultVal=null) {
  const env = process.env.ENV;
  if (env) {
    const envKey = `${key}_${env}`;
    if (r.has(envKey, process.env)) {
      return process.env[envKey];
    }
  }
  if (r.has(key, process.env)) {
    return process.env[key];
  }
  return defaultVal;
}

module.exports = {
  getVal
};
