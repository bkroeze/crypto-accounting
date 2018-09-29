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
  t.is(results[0].entries[1].getFullShortcut(), '0.96555 BTC Assets:Exchanges:Coinbase @ 200 USD');
  t.is(results[0].entries[0].getFullShortcut(), '200 USD');
  results[0].id = 'test';
  t.is(results[0].toYaml(), `- id: test
  account: Equity:Checking
  status: cleared
  party: Coinbase
  utc: 2013-08-01T07:00:00.000Z
  trades:
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
  utc: 2018-01-01T08:00:00.000Z
  debits:
    - 1 USD
  credits:
    - 1 USD assets:test
`);
  t.is(result[1].toYaml(), `- id: test2
  account: income
  status: cleared
  party: Test2
  utc: 2018-01-02T08:00:00.000Z
  trades:
    - 1 USD assets:test @ 1 GIN
`);
    t.is(result[2].toYaml(), `- id: test3
  account: exchange
  status: cleared
  party: Test3
  utc: 2018-01-03T08:00:00.000Z
  trades:
    - 10 ETH @ 200 USD
`);
});
