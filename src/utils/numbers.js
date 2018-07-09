import BigNumber from 'bignumber.js';
import * as R from 'ramda';

export const BIG_0 = BigNumber(0);

export const addBigNumbers = R.reduce((acc, val) => acc.plus(val), BIG_0);

export const isNegativeString = val => BigNumber(val).lt(BIG_0);

export function positiveString(val) {
  return isNegativeString(val) ? val.slice(1) : val;
}
