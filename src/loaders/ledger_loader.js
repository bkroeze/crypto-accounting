/* eslint no-unused-vars: off */

const R = require('ramda');
const { contained } = require('ramda-adjunct');
const path = require('path');

const { getFS } = require('./common');
const { splitAndTrim, isTime } = require('../utils/models');
const Transaction = require('../models/transaction');
const { isRelativePath } = require('../utils/files');
const { LEDGER_COMMENTS } = require('../models/constants')

const trimRight = val => val.trimRight;
const isCommentChar = contained(LEDGER_COMMENTS);
const isLeadingCommentLine = val => isCommentChar(val.slice(0, 1));
const stripLeadingCommentLines = R.reject(isLeadingCommentLine);
const isCommentLine = val => isCommentChar(val.trimLeft().slice(0, 1));
const isNumeric = contained('0123456789');
const isNewTransactionLine = val => isNumeric(val.slice(0, 1));
const isAccountKey = contained(['id', 'account', 'note', 'status', 'address', 'party']);
const addEqualsConnector = R.insert(0, '=');
const lineCommentSpaces = /\; */;
const groupByPartType = R.groupBy((part) => {
  return isLeadingCommentLine(part) ? 'comments' : 'parts';
});

function shortcutFromLedgerLine(line) {
  const clean = line
        .replace(lineCommentSpaces, ';')
        .replace(/@@/g, '=');
  let parts = splitAndTrim(clean);
  const account = parts.shift();
  const parsed = groupByPartType(parts);
  parts = parsed.parts;
  parts.push(account);
  if (parts.length <= 3) {
    // in Ledger format, if it is a single-posting, then it is a debit
    // so use the leading-equals shortcut for that.
    parts = addEqualsConnector(parts);
  }
  // add comments to end;
  while (parsed.comments && parsed.comments.length > 0) {
    parts.push(parsed.comments.shift());
  }
  return parts.join(' ');
}

function convertLedgerTransaction(lines) {
  const header = splitAndTrim(lines.shift());
  // get the utc, replacing / with -.
  let utc = header.shift().split('/').join('-');
  let status = '';

  // has time?
  if (header[0].length > 1 && isTime(header[0])) {
    utc = `${utc} ${header.shift()}`;
  }
  if (header[0].length === 1 && header.length > 1) {
    status = header.shift();
    if (status === '*') {
      status = 'cleared';
    }
  }
  const party = header.join(' ');
  const extra = {};
  let account = '';
  const address = '';
  const notes = [];
  const props = {};
  const entryLines = [];
  // process comment lines first, so that all we will have left are entries
  lines.forEach((line) => {
    if (!isLeadingCommentLine(line)) {
      entryLines.push(line);
    } else {
      const linetext = line.slice(1);
      if (line.indexOf(':') === -1) {
        notes.push(linetext);
      } else {
        const parts = linetext.split(':');
        const key = parts[0].toLowerCase();
        const val = parts.slice(1).join(':');
        if (key === 'notes') {
          notes.push(val);
        } else if (isAccountKey(key)) {
          props[key] = val;
        } else {
          extra[key] = val;
        }
      }
    }
  });
  // check to see if we have a default account
  if (entryLines.length > 0) {
    const lastLine = entryLines[entryLines.length - 1];
    if (lastLine.indexOf(' ') === -1) {
      // yes, this is an "elided" Ledger entry
      account = entryLines.pop();
    }
  }

  const entries = entryLines.map(shortcutFromLedgerLine);

  return new Transaction({
    ...props,
    utc,
    status,
    party,
    account,
    address,
    note: notes.join('\n'),
    extra,
    entries,
  });
}

function loadLedgerTransactions(raw) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const linesets = [];
  let accum = [];

  stripLeadingCommentLines(lines).forEach((line) => {
    const clean = line.trimRight();
    if (!R.isEmpty(clean)) {
      if (isNewTransactionLine(line) && accum.length > 0) {
        linesets.push(accum);
        accum = [line];
      } else {
        accum.push(clean.trimLeft());
      }
    }
  });
  if (accum.length > 0) {
    linesets.push(accum);
  }

  // now we have an array of "linesets" which each are a transaction, hopefully.
  return linesets.map(convertLedgerTransaction);
}

function loadTransactionsFromFilenameSync(fname, directory) {
  let link = fname;
  if (directory && isRelativePath(fname)) {
    link = path.normalize(`${directory}/${fname}`);
  }
  return loadLedgerTransactions(getFS().readFileSync(link, 'utf-8'));
}

module.exports = {
  shortcutFromLedgerLine,
  loadTransactionsFromFilenameSync,
  loadLedgerTransactions,
  convertLedgerTransaction,
};
