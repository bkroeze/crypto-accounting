/* eslint no-console: ["error", { allow: ["error"] }] */
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';
import * as utils from '../utils/models';

import { ERRORS } from './constants';
import { makeError } from '../utils/errors';

const DEFAULT_PROPS = {
  id: '',
  name: '',
  note: '',
  translation: '',
  fiatDefault: false,
  tags: [],
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);

/**
 * Represents any currency or non-stock tradeable commodity.
 */
export class Currency {
  /**
   * Construct using a `props` object that must include "id", and may also
   * include "name" and "note"
   * @param {object} props
   */
  constructor(props = {}) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));

    KEYS.forEach((key) => {
      this[key] = merged[key];
    });

    if (!this.id) {
      console.error(`Invalid Currency, must have an id, got: ${JSON.stringify(props)}`);
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        'Invalid Currency, must have an id'
      );
    }
    if (!this.name) {
      this.name = this.id;
    }
  }

  /**
   * Make a currencies object from a yaml description
   * @param {Object<String, Object} raw object representation, typically from YAML load
   * @return {Object<String, Currency} currencies keyed by id
   */
  static makeCurrencies(raw) {
    const currencies = {};
    R.keysIn(raw).forEach((id) => {
      currencies[id] = new Currency(R.merge(raw[id], { id }));
    });
    return currencies;
  }

  /**
   * Test whether this currency has a specific flag.
   * @param {String} tag to search for
   * @return {Boolean} true if found
   */
  hasTag(tag) {
    return RA.contained(this.tags, tag);
  }

  /**
   * Check to see if this currency is to be treated as a fiat currency.
   * @return {Boolean} true if fiat
   */
  isFiat() {
    return this.fiatDefault || this.hasTag('fiat');
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @return {Object<String, *>}
   */
  toObject(options) {
    return utils.stripFalsyExcept({
      id: this.id,
      name: this.name,
      note: this.note,
      translation: this.translation,
      fiatDefault: this.fiatDefault,
      tags: this.tags,
    });
  }

  toString() {
    return `Currency: ${this.id}`;
  }
}
