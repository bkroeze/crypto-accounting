const { CREDIT, SYMBOL_MAP } = require('./constants');
const Entry = require('./entry');

class Credit extends Entry {
  constructor(props = {}) {
    super({
      ...props,
      type: CREDIT,
    });
  }

}

module.exports = Credit;
