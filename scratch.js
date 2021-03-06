var loader = require('./src/loaders/loader');
var journal = loader.loadJournalFromFilenameSync('journal_gains1.yaml', 'test/models/fixtures/');
var acct = journal.getAccount('cb');
//console.log(acct.toObject(true));

//console.log('debits', acct.getEntries('debit').map(e => e.toObject(true)));

// const lots = acct.getLots(journal.currencies);
// console.log('got');
// console.log('lots', lots);
// console.log('lot1', lots[0]);
// console.log('lot1', lots[0].toObject());

// var converter = require('./src/loaders/csv_converter');

// console.log(
//   converter.walletCsvToYamlSync(
//     '/home/bruce/Documents/Ledger/data/marco_2018-07-13.csv',
//     'MARCO',
//     'assets:crypto:wallet:MARCO',
//     'income:crypto:staking'
//   ));

// import PriceHistory from './src/models/pricehistory';

// const prices = [
//   '2018-06-16 ETH/USD 600',
//   '2018-06-17 BTC/USD 7000',
//   '2018-06-17 ETH/USD 650',
//   '2018-06-17 GIN/BTC 0.0001',
//   '2018-06-18 BTC/USD 6800',
//   '2018-06-18 ETH/USD 650',
//   '2018-06-18 GIN/BTC 0.00011',
//   '2018-06-19 ETH/USD 700',
//   '2018-06-20 ETH/USD 650',
// ];
// const history = new PriceHistory(prices);
// const price = history.findPrice('2018-06-17', 'GIN', 'USD', ['BTC']);
// console.log(price.toObject());

// import Transaction from './src/models/transaction';

// const transaction = new Transaction({
//   account: 'test',
//   utc: '2018-07-04',
//   entries: [
//     '-10 ETH @ 400 USD exchange',
//   ]
// });

// console.log(transaction.toObject());
// console.log('credits\n',transaction.getCredits().map(x => x.toObject()));
// console.log('debuts\n',transaction.getDebits().map(x => x.toObject()));

// const Transaction = require('./src/models/transaction');

// const tx = new Transaction({
//     account: 'test',
//     utc: '2018-07-04',
//     trades: ['10 ETH @ 400 USD exchange']
//   });


const storage = require('./src/loaders/storage');
const priceDB = require('./src/loaders/priceDB');
const PairPrice = require('./src/models/pairprice');
const PriceHistory = require('./src/models/pricehistory');
const prices = [
  '2018-01-02 ETH/USD 400',
  '2018-01-02 BTC/USD 500',
  '2018-01-02 ETH/BTC 500',
  '2018-01-02 ETH/XRP 1000',
  '2018-01-01 ETH/XRP 1001',
  '2018-06-16 ETH/USD 600',
  '2018-06-17 BTC/USD 7000',
  '2018-06-17 ETH/USD 650',
  '2018-06-17 GIN/BTC 0.0001',
  '2018-06-18 BTC/USD 6800',
  '2018-06-18 ETH/USD 650',
  '2018-06-18 GIN/BTC 0.00011',
  '2018-06-19 ETH/USD 700',
  '2018-06-20 ETH/USD 650',
];

let history = null;

PriceHistory.load(prices, 'test.db').then(p => history = p);
