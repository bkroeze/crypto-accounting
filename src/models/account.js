import * as R from 'ramda';

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
      log.error(`Invalid Account, must have an id, got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Account, must have a path');
    }
    if (this.parent) {
      this.path = `${this.parent.path}:${this.path}`;
    }
    if (!this.alias) {
      this.alias == this.path;
    }

    // recursively load the children
    this.children = children.map(child => {
      return new Account(R.merge(child, {parent: this}));
    });
  }

  toObject() {
    return {
      path: this.path,
      alias: this.alias,
      note: this.note,
      tags: this.tags,
      portfolio: this.portfolio,
      children: this.children.map(c => c.toObject())
    }
  }

  toString() {
    return `Currency: ${this.id}`;
  }
}
