import { DEBIT } from './constants';
import { Entry } from './entry';

export class Debit extends Entry {
  constructor(props = {}) {
    super({
      ...props,
      type: DEBIT,
    });
  }
}
