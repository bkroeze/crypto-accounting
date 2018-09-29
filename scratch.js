// var loader = require('./src/loaders/loader');
// var journal = loader.loadJournalFromFilenameSync('journal_2.yaml', 'test/models/fixtures/');
// var acct = journal.getAccount('cb');
// //console.log(acct.toObject(true));

// //console.log('debits', acct.getEntries('debit').map(e => e.toObject(true)));

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

const {b: a} = {b: 'test'};
console.log(`a is ${a}`);
test (foo)

testing foo
