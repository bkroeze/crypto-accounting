import test from 'ava';
import Result from 'folktale/result';
import { CREDIT, DEBIT } from '../../src/models/constants';
import { loadLedgerTransactions, convertLedgerTransaction, ledgerTransactionToObject, shortcutFromLedgerLine } from '../../src/loaders/ledger_loader';
import { rowToYaml } from '../../src/loaders/csv_converter';

import MockFS from '../mockfs';

test('converts a ledger line to a debit shortcut', (t) => {
  const result = shortcutFromLedgerLine('test 1 ETH');
  t.true(result instanceof Result.Ok);
  t.deepEqual(result.merge(), {
    shortcut: '1 ETH test',
    type: 'debits',
  });
});

test('converts a ledger line with a comment to a debit shortcut', (t) => {
  const result = shortcutFromLedgerLine('test 1 ETH ;foo');
  t.true(result instanceof Result.Ok);
  t.deepEqual(result.merge(), {
    shortcut: '1 ETH test ;foo',
    type: 'debits',
  });
});

test('converts a ledger line with a comment to a credit shortcut', (t) => {
  const result = shortcutFromLedgerLine('test -1 ETH ;foo');
  t.true(result instanceof Result.Ok);
  t.deepEqual(result.merge(), {
    shortcut: '1 ETH test ;foo',
    type: 'credits',
  });
});

test('converts a ledger line for a trade with a comment to a trade shortcut', (t) => {
  const result = shortcutFromLedgerLine('test 1 ETH @ $100 ;foo');
  t.true(result instanceof Result.Ok);
  t.deepEqual(result.merge(), {
    shortcut: '1 ETH test @ 100 USD ;foo',
    type: 'trades',
  });
});

test('converts a ledger line for an "equals" trade with a comment to a trade shortcut', (t) => {
  const result = shortcutFromLedgerLine('test 1 ETH = $100 ;foo');
  t.true(result instanceof Result.Ok);
  t.deepEqual(result.merge(), {
    shortcut: '1 ETH test = 100 USD ;foo',
    type: 'trades',
  });
});

test('converts a transaction to Object', (t) => {
  const ledger = (`2013/08/01 * Coinbase
    Assets:Exchanges:Coinbase      0.96555 BTC = $200
    Equity:Checking
`).split('\n');
  const result = ledgerTransactionToObject(ledger);
  t.deepEqual(result, {
    account: 'Equity:Checking',
    credits: [],
    debits: [],
    errors: [],
    extra: {},
    note: '',
    party: 'Coinbase',
    status: 'cleared',
    trades: [
      '0.96555 BTC Assets:Exchanges:Coinbase = 200 USD'
    ],
    utc: '2013-08-01',
  });
});

test('converts an "equals" transaction', (t) => {
  const ledger = `2013/08/01 * Coinbase
    Assets:Exchanges:Coinbase      0.96555 BTC = $200
    Equity:Checking
`.split('\n');
  const result = convertLedgerTransaction(ledger);
  t.is(result.entries.length, 2);
  const [credit, debit] = result.entries;
  t.is(credit.type, CREDIT);
  t.is(credit.getFullShortcut(), '200 USD');
  t.is(debit.account, 'Assets:Exchanges:Coinbase');
  t.is(debit.getFullShortcut(), '0.96555 BTC Assets:Exchanges:Coinbase = 200 USD');
  result.id = 'test';
  t.is(result.toYaml(), `- id: test
  account: Equity:Checking
  status: cleared
  party: Coinbase
  utc: 2013-08-01T00:00:00.000Z
  trades:
    - 0.96555 BTC Assets:Exchanges:Coinbase = 200 USD
`);
});


test('Can load a simple set of ledger formatted entries', t => {
  const ledger = `
; test
2018/01/01 * Test
    assets:test  1 USD
    income

2018/01/02 * Test2
    assets:test  1 USD @ 1 GIN
    income

2018/01/03 * Test3
    exchange  10 ETH @ $200
    exchange
`;
  const result = loadLedgerTransactions(ledger);
  // result.forEach(r => {
  //   console.log(JSON.stringify(r.toObject(), null, 2));
  // });
  t.is(result.length, 3);
  result[0].id = 'test1';
  result[1].id = 'test2';
  result[2].id = 'test3';
  t.is(result[0].toYaml(), `- id: test1
  account: income
  status: cleared
  party: Test
  utc: 2018-01-01T00:00:00.000Z
  debits:
    - 1 USD assets:test
  credits:
    - 1 USD
`);
  t.is(result[1].toYaml(), `- id: test2
  account: income
  status: cleared
  party: Test2
  utc: 2018-01-02T00:00:00.000Z
  trades:
    - 1 USD assets:test @ 1 GIN
`);
  t.is(result[2].toYaml(), `- id: test3
  account: exchange
  status: cleared
  party: Test3
  utc: 2018-01-03T00:00:00.000Z
  trades:
    - 10 ETH exchange @ 200 USD
`);
});
