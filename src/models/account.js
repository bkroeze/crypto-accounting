import * as R from 'ramda';

import * as utils from './modelUtils';

const DEFAULT_PROPS = {
  path: '',
  alias: '',
  note: '',
  tags: [],
  portfolio: '',
  parent: null,
  children: [],
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);

export default class Account {
  /**
   * Construct using a `props` object that must include "id", and may also include "name" and "notes"
   * @param {object} props
   */
  constructor(props={}) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    let children = [];

    KEYS.forEach(key => {
      if (key === 'children') {
        children = merged.children;
      } else {
        this[key] = merged[key];
      }
    });

    if (!this.path) {
      console.error(`Invalid Account, must have a path, got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Account, must have a path');
    }
    if (this.parent) {
      this.path = `${this.parent.path}:${this.path}`;
    }
    if (!this.alias) {
      this.alias == this.path;
    }

    this.children = Account.makeChildAccounts(this, children);
  }

  static makeChildAccounts(parent, children) {
    const accounts = {};
    R.keysIn(children).forEach(path => {
      const child = children[path];
      accounts[path] = new Account(R.merge(child, {parent, path}));
    });
    return accounts;
  }

  toObject() {
    return utils.stripFalsyExcept({
      path: this.path,
      alias: this.alias,
      note: this.note,
      tags: this.tags,
      portfolio: this.portfolio,
      children: utils.objectValsToObject(this.children)
    });
  }

  toString() {
    return `Currency: ${this.id}`;
  }
}

/**
 * Make an accounts object from a yaml description
 */
export function makeAccounts(raw) {
  const accounts = {};
  R.keysIn(raw).forEach(path => {
    accounts[path] = new Account(R.merge(raw[path], {path}));
  });
  return accounts;
}

