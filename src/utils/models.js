/* eslint no-underscore-dangle: off */
const R = require('ramda');
const RA = require('ramda-adjunct');

/**
 * Returns a copy of an object, with all members having falsy values removed,
 * except for those in the `butNot` list.
 * @param {object} toStrip
 * @param {array} (optional) list of keys to retain even if falsy
 * @return {object} stripped copy
 */
function stripFalsyExcept(toStrip, butNot = []) {
  const stripped = {};

  Object.keys(toStrip).forEach((key) => {
    const val = toStrip[key];
    if (R.indexOf(key, butNot) > -1 || (val && RA.isNotEmpty(val) && RA.isNotUndefined(val))) {
      stripped[key] = val;
    }
  });
  return stripped;
}

function stripFalsy(toStrip) {
  return stripFalsyExcept(toStrip, []);
}

/**
 * Simple helper for classes with "toObject" functions
 * @param {Object} work
 * @return {Object} work.toObject() results;
 */
function toObject(work) {
  return (work && R.has(toObject, work)) ? work.toObject() : null;
}

function arrayToObjects(work, shallow) {
  return work.map(x => x.toObject(shallow));
}

/**
 * Simple helper for classes with "toObject" functions
 * @param {Object} work
 * @return {Object} work.toObject() results;
 */
function toShallowObject(work) {
  return (work && R.has(toObject, work)) ? work.toObject(true) : null;
}

function objectValsToObject(obj) {
  const work = {};
  R.keysIn(obj).forEach((key) => {
    work[key] = obj[key].toObject();
  });
  return work;
}

const filterEmpty = R.filter(R.complement(R.isEmpty));
const mapTrim = R.map(R.trim);
const splitSpace = R.split(' ');
const numberRe = new RegExp(/^-?[0-9.]+$/);
const looksNumeric = val => val.search(numberRe) > -1;
const startsWithCarat = R.startsWith('^');
const isConnector = R.contains(R.__, ['@', '=']);
const timeRE = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]?$');
const isTime = (val) => timeRE.test(val);

function splitAndTrim(work) {
  return filterEmpty(mapTrim(splitSpace(work)));
}

module.exports = {
  arrayToObjects,
  filterEmpty,
  isConnector,
  isTime,
  looksNumeric,
  mapTrim,
  numberRe,
  objectValsToObject,
  splitAndTrim,
  splitSpace,
  startsWithCarat,
  stripFalsy,
  toObject,
  toShallowObject,
  stripFalsyExcept,
};
