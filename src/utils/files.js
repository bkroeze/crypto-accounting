import * as R from 'ramda';

export function isRelativePath(fname) {
  return !R.startsWith('/', fname) && fname.slice(1, 2) !== ':';
}

