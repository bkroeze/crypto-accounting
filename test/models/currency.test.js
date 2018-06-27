import test from 'ava';

import Currency from '../../src/models/currency';

test('Currency can instantiate via props', (t) => {
  const c = new Currency({ id: 'test' });
  t.is(c.id, 'test');
});

test('Currency can instantiate a full set of props', (t) => {
  const props = {
    id: 'test',
    name: 'foo',
    note: 'notes are nice',
  };
  const c = new Currency(props);
  t.deepEqual(c.toObject(), props);
});
