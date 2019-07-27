import { union, derivations } from 'folktale/adt/union';

export const CREDIT = 'credit';
export const DEBIT = 'debit';
export const INHERIT = '%INHERIT%';
export const CLEARED = 'cleared';
export const ERRORS = {};
export const LEDGER_LINE_COMMENT = ';';
export const LEDGER_COMMENTS = [';', '#', '|', '*'];
export const SYMBOL_MAP = new Map([['$', 'USD'], ['£', 'GBP'], ['€', 'EUR']]);

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
  ERRORS[k] = `ERR_${k}`;
});

function InvalidShortcut(shortcut, message) {
  return { shortcut, message };
}

function InvalidTrade(shortcut, message) {
  return { shortcut, message };
}

ERRORS.ParseErrors = union('parse-errors', {
  InvalidShortcut,
  InvalidTrade,
}).derive(
  derivations.equality,
  derivations.debugRepresentation
);
