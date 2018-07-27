import * as R from 'ramda'

export const setUnion = (a, b) => new Set([...a, ...b]);

export const mergeSets = R.reduce(setUnion, new Set());

export const setDifference = (a, b) => new Set([...a].filter(x => !b.has(x)));

export default {
  mergeSets,
  setUnion,
};

