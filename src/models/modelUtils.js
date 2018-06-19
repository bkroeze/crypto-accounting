import * as R from 'ramda';

/**
 * Returns a copy of an object, with all members having falsy values removed, except for those in the `butNot` list.
 * @param {object} toStrip
 * @param {array} (optional) list of keys to retain even if falsy
 * @return {object} stripped copy
 */
export function stripFalsyExcept(toStrip, butNot=[]) {
  const stripped = {};

  Object.keys(toStrip).forEach(key => {
    const val = toStrip[key];
    if (R.indexOf(key, butNot) > -1 || val) {
      stripped[key] = val;
    }
  });
  return stripped;
}

/**
 * Simple helper for classes with "toObject" functions
 * @param {Object} work
 * @return {Object} work.toObject() results;
 */
export function toObject(work) {
  return work.toObject();
}
