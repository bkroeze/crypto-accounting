const constants = {
  CREDIT: 'credit',
  DEBIT: 'debit',
  INHERIT: '%INHERIT%',
  CLEARED: 'cleared',
  ERRORS: {}
};

['EMPTY', 'EXHAUSTED', 'INVALID_ACCOUNT', 'INVALID_SHORTCUT', 'INVALID_TERM', 'MISSING_ACCOUNT', 'MISSING_PARAMETER', 'NOT_FOUND', 'OUT_OF_RANGE'].forEach(k => {
  constants.ERRORS[k] = `ERR_${k}`;
});

module.exports = constants;
//# sourceMappingURL=constants.js.map
