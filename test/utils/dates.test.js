import test from 'ava';
import Moment from 'moment';
import { averageDates } from '../../src/utils/dates';

test('should average dates', (t) => {
  const dates = [
    Moment('2018-01-01T00:00:00.000Z'),
    Moment('2018-01-03T00:00:00.000Z'),
  ];
  const avg = averageDates(dates[0], dates[1]);
  t.is(avg.toISOString(), '2018-01-02T00:00:00.000Z');
});
