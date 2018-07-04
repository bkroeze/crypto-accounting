var loader = require('./src/loaders/loader');
var journal = loader.loadJournalFromFilenameSync('journal_2.yaml', 'test/models/fixtures/');
var acct = journal.getAccount('cb');
