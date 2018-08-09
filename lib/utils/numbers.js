const BigNumber = require('bignumber.js');
const R = require('ramda');
const sha = require('sha.js');

const BIG_0 = BigNumber(0);
const BIG_1 = BigNumber(1);

const addBigNumbers = R.reduce((acc, val) => acc.plus(val), BIG_0);

const isNegativeString = val => BigNumber(val).lt(BIG_0);

function positiveString(val) {
  return isNegativeString(val) ? val.slice(1) : val;
}

function calcHashId(data) {
  const hasher = new sha.sha256();
  hasher.update(JSON.stringify(data));
  return hasher.digest('hex');
}

module.exports = {
  BIG_0,
  BIG_1,
  addBigNumbers,
  calcHashId,
  isNegativeString,
  positiveString
};
//# sourceMappingURL=numbers.js.map
