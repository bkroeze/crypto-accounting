/* eslint prefer-destructuring: ["error", { array: false }] */
const R = require('ramda');
const RA = require('ramda-adjunct');

const utils = require('../utils/models');
const BigNumber = require('bignumber.js');
const { makeError } = require('../utils/errors');
const {
  BIG_0, addBigNumbers, isNegativeString, positiveString, calcHashId,
} = require('../utils/numbers');
const { CREDIT, DEBIT, ERRORS, SYMBOL_MAP, LEDGER_COMMENTS, LEDGER_LINE_COMMENT } = require('./constants');
const log = require('js-logger').get('c.a.models.entry');
const lineSpaces = new RegExp(/  /, 'g');
const lineCommentSpaces = /\; */;
const tabRe = new RegExp(/\t/, 'g');
const commaRe = new RegExp(/,/, 'g');

const isCommentToken = R.startsWith(LEDGER_LINE_COMMENT);
const lastTokenIsComment = (val) => isCommentToken(R.last(val));

function describeLots(wrappers) {
  return wrappers.map(wrapper => ({
    ...wrapper.lot.toObject(),
    applied: wrapper.applied.toFixed(8),
  }));
}

const mergeProps = props => ({
  id: null,
  transaction: null,
  quantity: null,
  currency: '',
  account: '',
  lots: [],
  type: DEBIT,
  note: '',
  shortcut: '',
  pair: null,
  balancing: null, // the other entry in a balancing pair
  virtual: false,
  ...props,
});

const KEYS = R.keysIn(mergeProps({}));
const getProps = R.pick(KEYS);
const hasCredits = R.has('credits');
const hasDebits = R.has('debits');
const hasEntries = R.has('entries');
const isCredit = R.propEq('type', 'credit');
const isDebit = R.propEq('type', 'debit');

const hasLeadingSymbol = (symbol, val) => {
  return val.slice(0,1) === symbol && utils.looksNumeric(val.slice(1));
}

function getLotCredits(currency, lots) {
  return lots
    .filter(R.propEq('currency', currency))
    .map(R.prop('applied'));
}

function splitComment(val) {
  const cleaned = val.replace(lineSpaces, ' ').replace(tabRe, ' ');

  let ix = cleaned.indexOf(LEDGER_LINE_COMMENT);
  if (ix > -1) {
    return [cleaned.slice(0, ix), cleaned.slice(ix).replace(lineCommentSpaces, ';')];
  }
  return [cleaned, null];
}

function tokenizeShortcut(shortcut, leadingSymbolMap = SYMBOL_MAP) {
  const fixLeadingSymbol = (token) => {
    let work = token;
    leadingSymbolMap.forEach((currency, symbol) => {
      if (hasLeadingSymbol(symbol, token)) {
        work = `${token.slice(1)} ${currency}`;
      }
    });
    return work;
  };

  // check for comment
  let [cleaned, comment] = splitComment(shortcut);

  // have to pass over string twice, first time to clean up any
  // $100 style entries, converting to 100 USD
  cleaned = utils.splitAndTrim(cleaned)
        .map(fixLeadingSymbol)
        .join(' ');

  // The second time, we want to tokenize the string
  const tokens = utils.splitAndTrim(cleaned);

  // minimal shortcut: "10 BTC"
  if (tokens.length < 2) {
    console.error(`Invalid shortcut (need 2 parts): ${shortcut}`);
    throw makeError(
      TypeError,
      ERRORS.INVALID_SHORTCUT,
      `Invalid shortcut (need 2 parts): ${shortcut}`
    );
  }

  if (comment) {
    tokens.push(comment);
  }
  return tokens;
}

class Entry {
  /**
   * Construct using a `props` object that must include the parent transaction
   * @param {String|Object} shortcut string, or full object
   * @throws {TypeError} if props cannot be parsed
   */
  constructor(props = { }) {
    const work = RA.isString(props) ? { shortcut: props } : props;
    const merged = mergeProps(getProps(work));
    if (!merged.transaction) {
      console.error(`Invalid Entry, must have a 'transaction', got: ${JSON.stringify(props)}`);
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        'Invalid Entry, must have a parent transaction'
      );
    }

    if (merged.shortcut && (merged.currency || merged.amount)) {
      console.error(`Invalid Entry, can't specify a shortcut and currency/amount: ${JSON.stringify(props)}`);
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        'Invalid Entry, conflicting shortcut'
      );
    }

    KEYS.forEach((key) => {
      this[key] = merged[key];
    });

    if (merged.shortcut) {
      this.applyShortcut(merged.shortcut);
    }

    if (R.isNil(this.quantity)) {
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        'Invalid Entry, no Quantity'
      );
    }

    // doesn't hurt to re-wrap if it isn't already a BigNumber
    this.quantity = new BigNumber(this.quantity);
    if (!this.id) {
      this.id = calcHashId(this.toObject({shallow: true}));
    }
  }

  /**
   * parses a list of entries, which may be objects or strings
   * @param {Array<Object|String} rawArray input
   * @param {String} entryType credit or debit
   */
  static arrayToEntries(rawArray, entryType, transaction) {
    return rawArray.map((entry) => {
      let props;
      if (RA.isString(entry)) {
        props = { shortcut: entry, transaction, type: entryType };
      } else {
        props = { ...entry, transaction, type: entryType };
      }
      return new Entry(props);
    });
  }

  /**
   * Parses a raw object with credits and/or debits array members
   * Pair posting: debit [@|=] credit
   * @param {String} shortcut
   * @return {Array<Entry>} list of entries
   * @example "10 BTC", "$ 10", "10 BTC @ $ 8000", "-10 ETH @ .03 BTC"
   */
  static objectToEntries(raw, transaction) {
    let entries = [];
    let debits = [];
    let credits = [];
    if (hasEntries(raw)) {
      credits = raw.entries.filter(isCredit);
      debits = raw.entries.filter(isDebit);
    }

    if (hasDebits(raw)) {
      debits = R.concat(debits, raw.debits);
    }
    if (hasCredits(raw)) {
      credits = R.concat(credits, raw.credits);
    }

    if (debits) {
      debits = Entry.arrayToEntries(debits, DEBIT, transaction);
    }

    if (credits) {
      credits = Entry.arrayToEntries(credits, CREDIT, transaction);
    }

    return R.concat(debits, credits);
  }

  /**
   * Parses an entry "shortcut" into balanced Entries.
   * Shortcut can be in three forms:
   * - Single posting (credit): "quantity currency [account]"
   *   which will have a balancing debit created for it using the transaction debit account.
   * - Single posting (debit): "= quantity currency [account]"
   * - Pair posting: debit [@|=] credit
   *
   * @param {String} shortcut
   * @return {Object<string: Array<Posting>>} postings, keyed by "credits" and "debits"
   * @throws {TypeError} if shortcut cannot be parsed
   * @example "10 BTC", "$ 10", "10 BTC @ $ 8000", "-10 ETH @ .03 BTC"
   */
  static shortcutToEntries(rawShortcut, transaction, leadingSymbolMap = SYMBOL_MAP) {
    const tokens = tokenizeShortcut(rawShortcut, leadingSymbolMap);
    let accum = [];
    let connector = '';
    let current;
    let shortcuts = [];

    while (tokens.length > 0) {
      current = tokens.shift();
      if (!utils.isConnector(current)) {
        accum.push(current);
      } else {
        if (accum.length > 0) {
          shortcuts.push(accum);
        }
        connector = current;
        accum = [];
      }
    }
    if (accum.length < 2) {
      throw makeError(
        TypeError,
        ERRORS.INVALID_SHORTCUT,
        `Invalid shortcut: ${rawShortcut}`
      );
    }
    shortcuts.push(accum);

    if (shortcuts.length === 1) {
      if (connector !== '=') {
        // insert a debit at the front, without a specified account
        // this allows the default action to be from and to the same account
        // but if one is specified, then that is the credit account.
        shortcuts = [shortcuts[0].slice(0, 2), shortcuts[0]];
        connector = '=';
      } else {
        // a leading "=" connector means that this single-entry is a debit
        // so add a matching credit.
        shortcuts = [shortcuts[0], shortcuts[0].slice(0, 2)];
      }
    }
    let ix = 0;
    let debit;
    let credit;
    const entries = [];
    while (ix < shortcuts.length) {
      let debitIx = ix;
      let creditIx = ix + 1;

      const firstAmount = shortcuts[debitIx][0];
      const negativeFirst = isNegativeString(firstAmount);
      if (negativeFirst) {
        // this is a credit, not a debit
        // take the positive value
        shortcuts[debitIx][0] = positiveString(firstAmount);
        // and swap the shortcuts
        debitIx = ix + 1;
        creditIx = ix;
      }

      const catcher = (err) => {
        console.error(err.message, err.detail);
        return null;
      }

      const maker = (props) => new Entry(props);

      const makeEntry = R.tryCatch(maker, catcher);

      debit = makeEntry({
        shortcut: shortcuts[debitIx].join(' '),
        transaction,
        type: DEBIT,
      });
      credit = makeEntry({
        shortcut: shortcuts[creditIx].join(' '),
        transaction,
        type: CREDIT,
      });

      if (credit && debit) {
        if (negativeFirst) {
          credit.setPair(debit, connector === '@');
        } else {
          debit.setPair(credit, connector === '@');
        }
      }
      if (debit) {
        entries.push(debit)
      };
      if (credit) {
        entries.push(credit)
      };
      ix += 2;
    }
    return entries;
  }

  /**
   * Parses an one or more entries from a yaml-style "entry".
   * This means it may be:
   * - A string: shortcut
   * - An object: with one or both of "credits" or "debits" fields
   * @param {Object|String} raw object to parse
   * @return {Array<Entry>} List of entries parsed
   */
  static flexibleToEntries(raw, transaction) {
    if (RA.isString(raw)) {
      return Entry.shortcutToEntries(raw, transaction);
    }
    if (RA.isObj(raw)) {
      return Entry.objectToEntries(raw, transaction);
    }
    console.error('Invalid Entry', raw);
    throw makeError(
      TypeError,
      ERRORS.INVALID_SHORTCUT,
      'Invalid Entry: cannot parse'
    );
  }

  /**
   * Parse an entire list of shortcut or object entries and return a list of Entries
   * @param {Array<Object|String}} entries
   * @param {Transaction} transaction parent
   */
  static makeEntries(entries, transaction) {
    return R.flatten(entries.map(entry => Entry.flexibleToEntries(entry, transaction)));
  }

  static tokenizeShortcut (shortcut, leadingSymbolMap) {
    return tokenizeShortcut(shortcut, leadingSymbolMap);
  }

  /**
   * Parse and apply the shortcut to this object.
   * @param {String} shortcut
   * @param {Map} leadingSymbols to use, defaulting to {'$': 'USD', '£': 'GBP', '€': EUR'}
   */
  applyShortcut(shortcut, leadingSymbolMap = SYMBOL_MAP) {
    const tokens = Entry.tokenizeShortcut(shortcut, leadingSymbolMap);

    if (lastTokenIsComment(tokens)) {
      this.note = tokens.pop().slice(1).trim(); // strip leading comment char
    }

    if (tokens.length > 3) {
      throw makeError(
        TypeError,
        ERRORS.INVALID_SHORTCUT,
        `Invalid shortcut (unknown extra fields): ${shortcut}`
      );
    }
    // determine which token is the currency
    let quantity;
    let currency;

    const numeric1 = utils.looksNumeric(tokens[0]);
    const numeric2 = utils.looksNumeric(tokens[1]);

    if (tokens.length === 3) {
      this.account = tokens[2];
    }

    if (numeric1 && numeric2) {
      throw makeError(
        TypeError,
        ERRORS.INVALID_SHORTCUT,
        `Invalid Posting, two numeric in shortcut: ${shortcut}`
      );
    }

    if (!(numeric1 || numeric2)) {
      throw makeError(
        TypeError,
        ERRORS.INVALID_SHORTCUT,
        `Invalid Posting, no numeric in shortcut: ${shortcut}`
      );
    }

    if (numeric1) {
      [quantity, currency] = tokens;
    } else {
      [currency, quantity] = tokens;
    }

    quantity = quantity.replace(commaRe, '');
    this.quantity = BigNumber(quantity);
    this.currency = currency;
  }

  /**
   * Add this entry to the correct account.
   * @param {Accounts} Accounts
   * @return {Account} account for this entry
   */
  applyToAccount(accounts) {
    let acct;
    try {
      acct = accounts.get(this.getAccountPath());
      acct.addEntry(this);
    } catch (e) {
      if (e.message === ERRORS.NOT_FOUND) {
        console.error(`Warning, invalid journal, missing account ${this.getAccountPath()}`);
      }
    }
    return acct;
  }

  equals(entry) {
    return (
      entry
        && R.is(Entry, entry)
        && this.quantity.eq(entry.quantity)
        && this.currency === entry.currency
        && this.type === entry.type
    );
  }

  /**
   * Get the account for this entry, defaulting to the transaction account for this
   * type if not directly set.
   * @return {Account} Account
   */
  getAccount() {
    return this.account || this.transaction.account[this.type];
  }

  /**
   * Return the account path
   * @throws {TypeError} if none
   */
  getAccountPath() {
    const account = this.getAccount();
    if (!account) {
      console.error('no account!', this);
      throw makeError(
        TypeError,
        ERRORS.INVALID_SHORTCUT,
        'invalid account path'
      );
    }
    if (RA.isString(account)) {
      return account;
    }
    return account.path;
  }

  /**
   * Get the amount remaining of this credit, not yet applied to lots.
   * @return {BigNumber} amount remaining
   */
  getLotCreditRemaining() {
    if (this.TYPE === DEBIT) {
      return BIG_0;
    }

    const credits = addBigNumbers(getLotCredits(this.currency, this.lots));
    return this.quantity.minus(credits);
  }

  /**
   * Get a shortcut for this entry.  If it is a debit and has a credit, then add that to the shortcut.
   */
  getFullShortcut() {
    if (this.type === DEBIT && this.pair && !(this.pair.quantity.eq(this.quantity) && this.pair.currency === this.currency)) {
      return `${this.shortcut} @ ${this.pair.shortcut}`;
    }
    return this.shortcut;
  }

  /**
   * Get the date for this entry, defaulting to the transaction date if not directly set.
   * @return {Moment} date
   */
  getUtc() {
    return this.transaction.utc;
  }

  /**
   * Apply as much as possible of our remaining credit amount to the specified lot.
   * @param {Lot} lot
   * @param {BigNumber} maximum to apply
   * @return {BigNumber} how much was applied to the lot
   */
  setLot(lot, maxQuantity) {
    let applied = this.quantity;
    if (this.type === CREDIT) {
      const remainingLot = lot.getRemaining();
      const remainingCredit = this.getLotCreditRemaining();
      applied = BigNumber.min(remainingCredit, remainingLot, maxQuantity);
      /* console.log(`rl = ${remainingLot.toFixed(2)}
         rc = ${remainingCredit.toFixed(2)}
         max = ${maxQuantity.toFixed(2)}
         ap = ${applied}`); */
    }
    if (applied.gt(BIG_0)) {
      this.lots.push({ lot, applied });
    }
    return applied;
  }

  /**
   * Test whether this entry is in the specified account or one of its parents.
   * @param {String} path
   * @return {Boolean} true if found
   */
  inAccount(path) {
    const acct = this.getAccount();
    if (RA.isString(acct)) {
      return RA.contained(acct.split(':'), path);
    }
    return acct.inPath(path);
  }

  /**
   * Test whether this entry has a proper balancing entry.
   * @return {Boolean} true if balanced
   */
  isBalanced() {
    return !!(this.pair && (
      this.pair.currency !== this.currency
        || this.pair.getAccount() !== this.getAccount()
    ));
  }

  /**
   * Test whether this is a balancing entry.
   * @return {Boolean} true if balancing
   */
  isBalancingEntry() {
    return this.balancing && this.virtual;
  }

  /**
   * Make a balancing pair entry.
   * @param {Account} account
   * @return {Entry} new pair entry
   */
  makeBalancingClone(account) {
    this.balancing = new Entry({
      transaction: this.transaction,
      quantity: this.quantity,
      currency: this.currency,
      account: account.path,
      type: this.type === CREDIT ? DEBIT : CREDIT,
      balancing: this,
      virtual: true,
    });
    return this.balancing;
  }

  /**
   * Multiplies the current quantity by the quantity in the passed `Posting`.
   * @param {Posting} posting
   * @return {Posting} this
   */
  multiplyBy(posting) {
    this.quantity = this.quantity.times(posting.quantity);
    return this;
  }

  /**
   * Set the "other side" of the entry on this and its partner.
   * @param {Entry} other side (credit if this is debit, debit if this is credit)
   * @param {Boolean} true if the price is specified as "per each"
   */
  setPair(partner, priceEach) {
    this.pair = partner;
    if (priceEach) {
      // price specified as 'each', so it needs to be multiplied by
      // this quantity
      partner.multiplyBy(this);
    }
    if (partner.pair !== this) {
      // set the partner, but don't multiply
      partner.setPair(this, false);
    }
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @param {options} object with optional "shallow" and "yaml" fields
   * @return {Object<String, *>}
   */
  toObject(options = {}) {
    const {shallow, yaml} = options;
    const props = {
      id: this.id,
      quantity: this.quantity.toFixed(8),
      currency: this.currency,
      account: this.getAccountPath(),
      type: this.type,
      note: this.note,
      virtual: this.virtual,
    };

    if (!yaml) {
      props.pair = (!this.pair || shallow) ? null : this.pair.toObject({ yaml, shallow: true});
      props.balancing = (!this.balancing || shallow) ? null : this.balancing.toObject({ yaml, shallow: true });
      props.lots = shallow ? null : describeLots(this.lots);
    }

    return utils.stripFalsy(props);
  }

  toString() {
    return `Entry (${this.type}): ${this.quantity.toFixed(8)} ${this.currency} ${this.getAccount()}`;
  }
}

module.exports = Entry;
