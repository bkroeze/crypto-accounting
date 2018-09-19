import test from 'ava';

import { loadLedgerTransactions } from '../../src/loaders/ledger_loader';
import { rowToYaml } from '../../src/loaders/csv_converter';

import MockFS from '../mockfs';


test('loads a transaction with a dollar sign', (t) => {
  const ledger = `2013/08/01 * Coinbase
    Assets:Exchanges:Coinbase      0.96555 BTC = $200
    Equity:Checking
`;
  const results = loadLedgerTransactions(ledger);
  t.is(results.length, 1);
  t.is(results[0].entries.length, 2);
  t.is(results[0].entries[0].shortcut, '0.96555 BTC Assets:Exchanges:Coinbase');
  t.is(results[0].entries[1].shortcut, '200 USD');
  results[0].id = 'test';
  t.is(results[0].toYaml(), `- id: test
  account: Equity:Checking
  status: cleared
  party: Coinbase
  utc: 2013-08-01T07:00:00.000Z
  entries:
    - 0.96555 BTC Assets:Exchanges:Coinbase @ 200 USD
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
`;
  const result = loadLedgerTransactions(ledger);
  // result.forEach(r => {
  //   console.log(JSON.stringify(r.toObject(), null, 2));
  // });
  t.is(result.length, 2);
  result[0].id = 'test';
  t.is(result[0].toYaml(), `- id: test
  account: income
  status: cleared
  party: Test
  utc: 2018-01-01T08:00:00.000Z
  entries:
    - 1 USD assets:test
`);
});
