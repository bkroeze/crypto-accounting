/* eslint new-cap:off */
import BigNumber from 'bignumber.js';
import * as R from 'ramda';
import sha from 'sha.js';

export const BIG_0 = BigNumber(0);
export const BIG_1 = BigNumber(1);

export const addBigNumbers = R.reduce((acc, val) => acc.plus(val), BIG_0);

export const isNegativeString = val => BigNumber(val).lt(BIG_0);

export function positiveString(val) {
  return isNegativeString(val) ? val.slice(1) : val;
}

export function calcHashId(data) {
  const hasher = new sha.sha256();
  hasher.update(JSON.stringify(data));
  return hasher.digest('hex');
}
