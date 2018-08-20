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
  t.is(results[0].toYaml(), `- id: 485bd268d3e7c16d219bfc0c35450669cc2ead8b8dc029d6a1cfb19a7637286e
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
  t.is(result[0].toYaml(), `- id: 17e6cd23672d9a0d308037f72552c72bc8e7f0e225f3ac0b881efd68c0a0ff03
  account: income
  status: cleared
  party: Test
  utc: 2018-01-01T08:00:00.000Z
  entries:
    - 1 USD assets:test
`);
});
