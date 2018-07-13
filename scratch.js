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

var converter = require('./src/loaders/csv_converter');

console.log(
  converter.walletCsvToYamlSync(
    '/home/bruce/Documents/Ledger/data/marco_2018-07-13.csv',
    'MARCO',
    'assets:crypto:wallet:MARCO',
    'income:crypto:staking'
  ));
