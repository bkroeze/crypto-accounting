const { DEBIT, SYMBOL_MAP } = require('./constants');
const Entry = require('./entry');

class Debit extends Entry {
  constructor(props = {}) {
    super({
      ...props,
      type: DEBIT,
    });
  }
}

module.exports = Debit;
