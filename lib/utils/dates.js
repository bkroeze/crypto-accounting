const Moment = require('moment');

function averageDates(date1, date2) {
  let d1;
  let d2;
  if (date1.isBefore(date2)) {
    d1 = date1;
    d2 = date2;
  } else {
    d1 = date2;
    d2 = date1;
  }
  return Moment(d1.add(d2.diff(d1) / 2), 'ms');
}

function compareByDate(a, b) {
  if (a.utc.isBefore(b.utc)) {
    return -1;
  }
  if (a.utc.isAfter(b.utc)) {
    return 1;
  }
  return 0;
}

module.exports = {
  averageDates,
  compareByDate
};
//# sourceMappingURL=dates.js.map
