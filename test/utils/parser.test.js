import test from 'ava';
import Result from 'folktale/result';
import Parser from '../../src/utils/parser';
import { ERRORS } from '../../src/models/constants';

const parser = new Parser();

test('Should split comments from token', (t) => {
  const result = parser.tokenizeShortcut("1 ETH ;test");
  t.deepEqual(result.getOrElse('error'), {
    tokens: ['1', 'ETH'],
    comment: 'test',
  });
});

test('Should parse a simple trade', (t) => {
  const shortcut = '1 ETH @ $100';
  parser.parseTrade(shortcut)
    .matchWith({
      Ok: ({value}) => t.deepEqual(value, {
        debit: ['1', 'ETH'],
        credit: ['100', 'USD'],
        comment: null,
        connector: '@',
        reversed: false,
        shortcut,
      }),
      Error: ({value}) => {
        console.log('ERR', value);
        t.fail(value)
      },
    });
});

test('Should parse out a comment', (t) => {
  const shortcut = '1 ETH = $100 ;foo';
  const result = parser.parseTrade(shortcut);
  t.deepEqual(result.getOrElse('error'), {
    debit: ['1', 'ETH'],
    credit: ['100', 'USD'],
    comment: 'foo',
    connector: '=',
    reversed: false,
    shortcut,
  });
});

test('Should parse out a negative entry trade', (t) => {
  const shortcut = '-1 ETH @ $100 bank ;foo';
  const result = parser.parseTrade(shortcut);
  t.deepEqual(result.getOrElse('error'), {
    credit: ['1', 'ETH'],
    debit: ['100', 'USD', 'bank'],
    comment: 'foo',
    connector: '@',
    reversed: true,
    shortcut,
  });
});


test('Should fail if too short', (t) => {
  const result = parser.parseTrade('1');
  t.is(result.getOrElse('error'), 'error');
});

test('Should fail if just a debit', (t) => {
  parser.parseTrade('1 ETH bank')
    .matchWith({
      Ok: _ => t.fail('Should have not accepted without a second part of the trade.'),
      Error: ({ value }) => t.true(value instanceof ERRORS.ParseErrors.InvalidTrade),
    });
});

test('Should fail if no currency', (t) => {
  parser.parseTrade('1 @ 100 USD')
    .matchWith({
      Ok: _ => t.fail('Should have not accepted without a currency.'),
      Error: _ => t.pass('Should fail'),
    });
});

test('Should fail with two numeric', (t) => {
  parser.parseEntry('1 1 ;test')
    .matchWith({
      Ok: ({value}) => t.fail(JSON.stringify(value)),
      Error: ({value}) => t.true(value instanceof ERRORS.ParseErrors.InvalidShortcut),
    });
});

test('Should fail with two non-numeric', (t) => {
  parser.parseEntry('x y')
    .matchWith({
      Ok: ({value}) => t.fail(JSON.stringify(value)),
      Error: ({value}) => t.true(value instanceof ERRORS.ParseErrors.InvalidShortcut),
    });
});


test('Should parse a debit', (t) => {
  const shortcut = '1 ETH';
  parser.parseEntry(shortcut)
    .matchWith({
      Ok: ({value}) => t.deepEqual(value, {
        entry: ['1', 'ETH'],
        comment: null,
        shortcut,
      }),
      Error: ({value}) => t.fail(value)
    });
});

test('Should parse a debit with a comment and account', (t) => {
  const shortcut = '1 ETH Test:Account ;foo';
  parser.parseEntry(shortcut)
    .matchWith({
      Ok: ({value}) => t.deepEqual(value, {
        entry: ['1', 'ETH', 'Test:Account'],
        comment: 'foo',
        shortcut,
      }),
      Error: ({value}) => t.fail(value)
    });
});
