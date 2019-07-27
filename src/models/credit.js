import { CREDIT } from './constants';
import { Entry } from './entry';

export class Credit extends Entry {
  constructor(props = {}) {
    super({
      ...props,
      type: CREDIT,
    });
  }
}
