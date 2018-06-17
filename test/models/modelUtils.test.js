import test from 'ava';
import {stripFalsyExcept} from '../../src/models/modelUtils.js';

test('StripFalsy simple', t => {
  const raw = {
    lame: null,
    bad: 0,
    empty: '',
    that: 1,
    theother: 'x',
  };
  const stripped = stripFalsyExcept(raw);
  t.deepEqual(stripped, {
    that: 1,
    theother: 'x'
  });
});

test('StripFalsy with exceptions', t => {
  const raw = {
    lame: null,
    bad: 0,
    empty: '',
    that: 1,
    theother: 'x',
  };
  const stripped = stripFalsyExcept(raw, ['bad', 'empty', 'missing']);
  t.deepEqual(stripped, {
    bad: 0,
    empty: '',
    that: 1,
    theother: 'x'
  });
});

