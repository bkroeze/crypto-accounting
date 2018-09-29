var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

const { CREDIT, SYMBOL_MAP } = require('./constants');
const Entry = require('./entry');

class Credit extends Entry {
  constructor(props = {}) {
    super(_extends({}, props, {
      type: CREDIT
    }));
  }
}

module.exports = Credit;
//# sourceMappingURL=credit.js.map
