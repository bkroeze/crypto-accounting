import test from 'ava';
import Moment from 'moment';
import * as R from 'ramda';
import Journal from '../../src/models/journal';
import { BIG_0 } from '../../src/utils/numbers';
import { journalFinder } from '../utils';

const getJournalFromYaml = journalFinder(__dirname);

test('Should get accounts', (t) => {
  const work = {
    accounts: {
      test: {
        note: 'test a',
        children: {
          revenue: {
            note: 'test b',
          },
        },
      },
    },
    currencies: {
      BTC: {
        id: 'BTC',
        name: 'Bitcoin',
      },
      ETH: {
        id: 'ETH',
        name: 'Ethereum',
      },
    },
    transactions: [{
      utc: '2018-01-01T01:01:01.001Z',
      account: 'test',
      entries: ['100 ETH test:revenue'],
    }],
  };
  const journal = new Journal(work);
  const testAcc = journal.getAccount('test');
  t.truthy(testAcc);
});

test('Should get account by alias', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const acct = journal.getAccount('cb');
  t.is(acct.path, "assets:exchanges:coinbase");
});

test('Simple fixture test', (t) => {
  const journal = getJournalFromYaml('journal_1.yaml');
  t.truthy(journal, 'Should have loaded a journal');
  const exchanges = journal.getAccount('assets:exchanges');
  const total = exchanges.getTotalBalances();
  t.is(total.ETH.toFixed(1), '3.0');

  const byAccount = journal.getBalancesByAccount();
  t.is(byAccount['assets:exchanges:coinbase'].ETH.toFixed(2), '1.00');
  t.is(byAccount['assets:exchanges:binance'].ETH.toFixed(2), '2.00');
});

test('Tracks sales through multiple hops', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const byAccount = journal.getBalancesByAccount();
  // console.log(`byAccount ${JSON.stringify(byAccount, null, 2)}`);
  const coinbase = byAccount['assets:exchanges:coinbase'];
  const binance = byAccount['assets:exchanges:binance'];
  t.is(coinbase.ETH.toFixed(2), '0.10');
  t.is(coinbase.USD.toFixed(2), '60.00');
  t.is(binance.ETH.toFixed(1), '0.0');
  t.is(binance.GIN.toFixed(1), '0.0');
});

test('getBalancesByAccount can apply filters', (t) => {
  const journal = getJournalFromYaml('journal_mining.yaml');
  const total = journal.getBalancesByAccount();
  t.is(total['assets:wallets:ETH'].ETH.toFixed(3), '0.005');

  const day3 = Moment('2018-06-03');
  const threeDays = journal.getBalancesByAccount(e => e.getUtc().isSameOrBefore(day3));
  t.is(threeDays['assets:wallets:ETH'].ETH.toFixed(3), '0.003');
});

test('getBalancesByCurrency is accurate for multiple accounts', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  t.true(journal.getAccount('equity').isVirtual());
  t.false(journal.getAccount('cb').isVirtual());
  const checking = journal.getAccount('assets:banks:checking');
  t.false(checking.isVirtual());
  const byCurrency = journal.getBalancesByCurrency();
  // console.log(`byCurrency ${JSON.stringify(byCurrency, null, 2)}`);
  // console.log(JSON.stringify(checking.toObject(), null, 2));
  t.is(byCurrency.USD.quantity.toFixed(0), '1060');
  t.deepEqual(Object.keys(byCurrency.USD.accounts), ['assets:banks:checking', 'assets:exchanges:coinbase']);
  t.is(byCurrency.ETH.quantity.toFixed(2), '0.10');
});

test('getBalancesByCurrency can use filters', (t) => {
  const journal = getJournalFromYaml('journal_mining.yaml');
  const day3 = Moment('2018-06-03');
  const byCurrency = journal.getBalancesByCurrency((e) => {
    return e.getUtc().isSameOrBefore(day3) && !e.inAccount('revenue');
  });
  t.is(byCurrency.ETH.quantity.toFixed(3), '0.003');
});

test('Testing with virtual entries', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const equity = journal.getAccount('equity:test');
  const cb = journal.getAccount('cb');
  t.is(cb.getBalancingAccount(), 'equity:test');
  const byCurrency = journal.getBalancesByCurrency(null, true);
  t.true(byCurrency.USD.quantity.eq(BIG_0));
  t.true(byCurrency.ETH.quantity.eq(BIG_0));
});

test('Lots have remaining balances calculated', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const lots = journal.accounts.getLots(journal.currencies);
  // console.log('lots');
  // lots.forEach((l) => {
  //   console.log(l.toObject());
  // });
  t.is(lots.length, 4);
  t.is(lots[0].getRemaining().toFixed(1), '0.0');
  t.is(lots[0].currency, 'ETH');
  t.is(lots[1].getRemaining().toFixed(1), '0.0');
  t.is(lots[1].currency, 'GIN');
  t.is(lots[2].getRemaining().toFixed(1), '0.0');
  t.is(lots[2].currency, 'ETH');
  t.is(lots[3].getRemaining().toFixed(1), '0.1');
  t.is(lots[3].currency, 'ETH');
});

test('Lots have remaining balances calculated in lifo ordering too', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const lots = journal.accounts.getLots(journal.currencies, false, true);
  // console.log('lots');
  // lots.forEach((l) => {
  //   console.log(l.toObject());
  // });
  t.is(lots.length, 4);
  t.is(lots[0].getRemaining().toFixed(1), '0.1');
  t.is(lots[0].currency, 'ETH');
  t.is(lots[1].getRemaining().toFixed(1), '0.0');
  t.is(lots[1].currency, 'GIN');
  t.is(lots[2].getRemaining().toFixed(1), '0.0');
  t.is(lots[2].currency, 'ETH');
  t.is(lots[3].getRemaining().toFixed(1), '0.0');
  t.is(lots[3].currency, 'ETH');
});


test('Can get lots by currency', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const lots = journal.getLotsByCurrency();
  t.is(lots.ETH.length, 3);
  t.is(lots.GIN.length, 1);
});

test('Loads Price History', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const price = journal.pricehistory.findPrice('2018-06-18', 'GIN', 'BTC');
  t.deepEqual(price.rate.toFixed(5), '0.00011');
});

test('Finds translation currencies', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  t.deepEqual(journal.getTranslationCurrencies(), [journal.currencies.BTC, journal.currencies.ETH]);
});

test('Finds prices', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const price = journal.findPrice('2018-06-17', 'GIN', 'USD');
  t.is(price.rate.toFixed(2), '0.70');
});

test('Finds no currency problems on a clean journal', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const probs = journal.getCleanlinessOfCurrencies();
  t.is(probs.length, 0);
});

test('Finds missing currencies', (t) => {
  const journal = getJournalFromYaml('journal_currency_errors.yaml');
  const probs = journal.getCleanlinessOfCurrencies();
  t.is(probs.length, 3);
  t.deepEqual(probs, [ 'USD currency not defined in currencies list',
                       'ETH currency not defined in currencies list',
                       'GIN currency not defined in currencies list' ]);
});

test('Finds no account problems on a clean journal', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const probs = journal.getCleanlinessOfAccounts();
  t.is(probs.length, 0);
});

test('Finds missing accounts problems', (t) => {
  const journal = getJournalFromYaml('journal_missing_accounts.yaml');
  const probs = journal.getCleanlinessOfAccounts();
  t.is(probs.length, 1);
  t.deepEqual(probs, [ 'assets:exchanges:binance not defined in accounts list' ]);
});

test('Finds no unbalanced transactions on a clean journal', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const probs = journal.getCleanlinessOfTransactions();
  t.is(probs.length, 0);
});

test('Finds no problems on a clean journal', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const probs = journal.getCleanliness();
  t.true(R.isEmpty(probs));
});
