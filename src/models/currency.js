/* eslint no-console: ["error", { allow: ["error"] }] */
import * as R from 'ramda';
import * as utils from './modelUtils';

const DEFAULT_PROPS = {
  id: '',
  name: '',
  note: '',
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);

export default class Currency {
  /**
   * Construct using a `props` object that must include "id", and may also
   * include "name" and "notes"
   * @param {object} props
   */
  constructor(props = {}) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));

    KEYS.forEach((key) => {
      this[key] = merged[key];
    });

    if (!this.id) {
      console.error(`Invalid Currency, must have an id, got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Currency, must have an id');
    }
    if (!this.name) {
      this.name = this.id;
    }
  }

  toObject() {
    return utils.stripFalsyExcept({
      id: this.id,
      name: this.name,
      note: this.note,
    });
  }

  toString() {
    return `Currency: ${this.id}`;
  }
}

/**
 * Make a currencies object from a yaml description
 */
export function makeCurrencies(raw) {
  const currencies = {};
  R.keysIn(raw).forEach((id) => {
    currencies[id] = new Currency(R.merge(raw[id], { id }));
  });
  return currencies;
}
