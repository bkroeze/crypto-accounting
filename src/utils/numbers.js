import BigNumber from 'bignumber.js';

export const BIG_0 = BigNumber(0);

export const isNegativeString = val => BigNumber(val).lt(BIG_0);

export function positiveString(val) {
  return isNegativeString(val) ? val.slice(1) : val;
}
