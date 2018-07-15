import Moment from 'moment';

export function compareByDate(a, b) {
  if (a.utc.isBefore(b.utc)) {
    return -1;
  }
  if (a.utc.isAfter(b.utc)) {
    return 1;
  }
  return 0;
}
