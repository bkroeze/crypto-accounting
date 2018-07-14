/* eslint no-underscore-dangle: off */
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';

/**
 * Returns a copy of an object, with all members having falsy values removed,
 * except for those in the `butNot` list.
 * @param {object} toStrip
 * @param {array} (optional) list of keys to retain even if falsy
 * @return {object} stripped copy
 */
export function stripFalsyExcept(toStrip, butNot = []) {
  const stripped = {};

  Object.keys(toStrip).forEach((key) => {
    const val = toStrip[key];
    if (R.indexOf(key, butNot) > -1 || (val && RA.isNotEmpty(val) && RA.isNotUndefined(val))) {
      stripped[key] = val;
    }
  });
  return stripped;
}

export function stripFalsy(toStrip) {
  return stripFalsyExcept(toStrip, []);
}

/**
 * Simple helper for classes with "toObject" functions
 * @param {Object} work
 * @return {Object} work.toObject() results;
 */
export function toObject(work) {
  return (work && R.has(toObject, work)) ? work.toObject() : null;
}

export function arrayToObjects(work, shallow) {
  return work.map(x => x.toObject(shallow));
}

/**
 * Simple helper for classes with "toObject" functions
 * @param {Object} work
 * @return {Object} work.toObject() results;
 */
export function toShallowObject(work) {
  return (work && R.has(toObject, work)) ? work.toObject(true) : null;
}

export function objectValsToObject(obj) {
  const work = {};
  R.keysIn(obj).forEach((key) => {
    work[key] = obj[key].toObject();
  });
  return work;
}

export const filterEmpty = R.filter(R.complement(R.isEmpty));
export const mapTrim = R.map(R.trim);
export const splitSpace = R.split(' ');
export const numberRe = new RegExp(/^-?[0-9.]+$/);
export const looksNumeric = val => val.search(numberRe) > -1;
export const startsWithCarat = R.startsWith('^');
export const isConnector = R.contains(R.__, ['@', '=']);

export function splitAndTrim(work) {
  return filterEmpty(mapTrim(splitSpace(work)));
}
