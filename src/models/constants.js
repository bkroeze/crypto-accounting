export const CREDIT = 'credit';
export const DEBIT = 'debit';
export const INHERIT = '%INHERIT%';
export const CLEARED = 'cleared';
export const ERRORS = {};

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
