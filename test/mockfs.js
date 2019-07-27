import * as R from 'ramda';
import path from 'path';

export class MockFS {
  constructor(mocks) {
    this.mocks = mocks;
  }

  readFileSync(fname) {
    const { mocks } = this;

    if (R.has(fname, mocks)) {
      return mocks[fname];
    }
    const f = path.basename(fname);
    if (R.has(f, mocks)) {
      return mocks[f];
    }
    if (R.has('*', mocks)) {
      return mocks['*'];
    }
    throw new Error(`MockFS cannot find: ${fname}`);
  }
}
