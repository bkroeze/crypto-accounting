const BigNumber = require ('bignumber.js');
const R = require('ramda');

const BIG_0 = BigNumber(0);
const BIG_1 = BigNumber(1);

const addBigNumbers = R.reduce((acc, val) => acc.plus(val), BIG_0);

const isNegativeString = val => BigNumber(val).lt(BIG_0);

function positiveString(val) {
  return isNegativeString(val) ? val.slice(1) : val;
}

module.exports = {
  BIG_0,
  BIG_1,
  addBigNumbers,
  isNegativeString,
  positiveString,
};
