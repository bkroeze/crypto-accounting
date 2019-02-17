const Result = require('folktale/result');
const R = require('ramda');
const log = require('js-logger').get('cryptoaccounting.utils.parser');

const utils = require('./models');
const { ERRORS, SYMBOL_MAP, LEDGER_LINE_COMMENT } = require('../models/constants');
const { isNegativeString, positiveString } = require('./numbers');

const hasLeadingSymbol = (symbol, val) => {
  return val.slice(0, symbol.length) === symbol && utils.looksNumeric(val.slice(symbol.length));
};

const lineSpaces = new RegExp(/  /, 'g');
const tabRe = new RegExp(/\t/, 'g');

function sanityCheckTokens(tokens) {
  const rawTokens = tokens.join(' ');

  if (tokens.length < 2) {
    return Result.Error(ERRORS.ParseErrors.InvalidShortcut(rawTokens), 'Too short');
  }
  const numeric1 = utils.looksNumeric(tokens[0]);
  const numeric2 = utils.looksNumeric(tokens[1]);

  if (numeric1 && numeric2) {
    return Result.Error(ERRORS.ParseErrors.InvalidShortcut(rawTokens, 'Two numeric in shortcut'));
  }

  if (!(numeric1 || numeric2)) {
    return Result.Error(ERRORS.ParseErrors.InvalidShortcut(rawTokens, 'Need at least one numeric in shortcut'));
  }
  return Result.Ok(tokens);
}

function splitComment(val) {
  let shortcut;
  let comment = null;
  try {
    shortcut = val.replace(lineSpaces, ' ').replace(tabRe, ' ');
  } catch (e) {
    log.error('Could not split comment', val);
    return Result.Error(ERRORS.ParseErrors.InvalidShortcut(val, 'could not split comment'));
  }

  const ix = shortcut.indexOf(LEDGER_LINE_COMMENT);
  if (ix > -1) {
    comment = shortcut.slice(ix + 1).trim();
    shortcut = shortcut.slice(0, ix);
  }
  return Result.Ok({
    shortcut,
    comment,
  });
}

function fixLeadingSymbol(token, leadingSymbolMap) {
  let work = token;
  leadingSymbolMap.forEach((currency, symbol) => {
    if (hasLeadingSymbol(symbol, token)) {
      work = `${token.slice(1)} ${currency}`;
    }
  });
  return work;
}

class Parser {
  constructor(leadingSymbolMap = SYMBOL_MAP) {
    this.leadingSymbolMap = leadingSymbolMap;
  }

  static splitComment(val) {
    return splitComment(val);
  }

  fixLeadingSymbol(token) {
    return fixLeadingSymbol(token, this.leadingSymbolMap);
  }

  /**
   * Parses a single debit or credit shortcut
   * @param {String} shortcut
   * @return {Object} keyed by "entry" and "comment"
   */
  parseEntry(rawShortcut) {
    return this.tokenizeShortcut(rawShortcut)
      .chain(({ tokens, comment }) => {
        if (R.any(utils.isConnector, tokens)) {
          return Result.Error(ERRORS.ParseErrors.InvalidShortcut(
            rawShortcut, 'Cannot contain a connector for a debit or credit entry'
          ));
        }
        return sanityCheckTokens(tokens)
          .chain(entry => Result.Ok({ entry, comment, shortcut: rawShortcut }));
      });
  }

  /**
   * Parses an entry "trade" into balanced Entries.
   * Shortcut format is: debit [@|=] credit
   *
   * @param {String} shortcut
   * @return {Result<{Object<String: Array<String>>>} keyed by "credit", "debit"" and "comment"
   */
  parseTrade(rawShortcut) {
    return this.tokenizeShortcut(rawShortcut)
      .chain(({ tokens, comment }) => {
        let accum = [];
        let connector = '';
        let current;
        let reversed = false;
        const shortcuts = [];

        while (tokens.length > 0) {
          current = tokens.shift();
          if (!utils.isConnector(current)) {
            accum.push(current);
          } else {
            shortcuts.push(accum);
            connector = current;
            accum = [];
          }
        }
        shortcuts.push(accum);

        const errors = shortcuts
              .map(sanityCheckTokens)
              .filter(x => x instanceof Result.Error);

        if (errors.length > 0) {
          return Result.Error(errors);
        }

        if (shortcuts.length < 2 || !connector) {
          return Result.Error(ERRORS.ParseErrors.InvalidTrade(rawShortcut));
        }

        const [first, second] = shortcuts;
        if (isNegativeString(first[0])) {
          // Trade was entered with a credit instead of a debit, reverse them and strip the negative
          shortcuts[0] = second;
          shortcuts[1] = [positiveString(first[0]), ...first.slice(1)];
          reversed = true;
        }
        const [debit, credit] = shortcuts;
        return Result.Ok({
          debit,
          credit,
          comment,
          connector,
          reversed,
          shortcut: rawShortcut,
        });
      });
  }

  tokenizeShortcut(rawShortcut) {
    const { leadingSymbolMap } = this;
    return splitComment(rawShortcut)
      .chain(({ shortcut, comment }) => {
        // have to pass over string twice, first time to clean up any
        // $100 style entries, converting to 100 USD
        const cleaned = utils.splitAndTrim(shortcut)
              .map(work => fixLeadingSymbol(work, leadingSymbolMap))
              .join(' ');

        // The second time, we want to tokenize the string
        const tokens = utils.splitAndTrim(cleaned);

        // minimal shortcut: "10 BTC"
        if (tokens.length < 2) {
          log.error(`Invalid shortcut (need 2 parts): ${rawShortcut}`);
          return Result.Error(ERRORS.ParseErrors.InvalidShortcut(rawShortcut));
        }
        return Result.Ok({
          tokens,
          comment,
        });
      });
  }
}

module.exports = Parser;
