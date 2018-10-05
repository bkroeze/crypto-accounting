const { union, derivations } = require('folktale/adt/union');

const constants = {
  CREDIT: 'credit',
  DEBIT: 'debit',
  INHERIT: '%INHERIT%',
  CLEARED: 'cleared',
  ERRORS: {},
  LEDGER_LINE_COMMENT: ';',
  LEDGER_COMMENTS: [';', '#', '|', '*'],
  SYMBOL_MAP: new Map([['$', 'USD'], ['£', 'GBP'], ['€', 'EUR']]),
};

[
  'EMPTY',
  'EXHAUSTED',
  'INVALID_ACCOUNT',
  'INVALID_SHORTCUT',
  'INVALID_TERM',
  'MISSING_ACCOUNT',
  'MISSING_PARAMETER',
  'NOT_FOUND',
  'OUT_OF_RANGE',
].forEach((k) => {
  constants.ERRORS[k] = `ERR_${k}`;
});

function InvalidShortcut(message) {
  return { message };
}

function InvalidTrade(message) {
  return { message };
}

constants.ERRORS.ParseErrors = union('parse-errors', {
  InvalidShortcut,
  InvalidTrade,
}).derive(
  derivations.equality,
  derivations.debugRepresentation
);


module.exports = constants;
