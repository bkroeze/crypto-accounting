const R = require('ramda');

const setUnion = (a, b) => new Set([...a, ...b]);

const mergeSets = R.reduce(setUnion, new Set());

const setDifference = (a, b) => new Set([...a].filter(x => !b.has(x)));

module.exports = {
  mergeSets,
  setDifference,
  setUnion,
};

