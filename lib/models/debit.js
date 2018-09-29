var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

const { DEBIT, SYMBOL_MAP } = require('./constants');
const Entry = require('./entry');

class Debit extends Entry {
  constructor(props = {}) {
    super(_extends({}, props, {
      type: DEBIT
    }));
  }
}

module.exports = Debit;
//# sourceMappingURL=debit.js.map
