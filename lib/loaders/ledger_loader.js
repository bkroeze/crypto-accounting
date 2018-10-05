var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/* eslint no-unused-vars: off */

const R = require('ramda');
const Result = require('folktale/result');
const { contained } = require('ramda-adjunct');
const path = require('path');
const log = require('js-logger').get('ledger_loader');

const { getFS } = require('./common');
const { splitAndTrim, isTime, isConnector } = require('../utils/models');
const Transaction = require('../models/transaction');
const { isRelativePath } = require('../utils/files');
const { LEDGER_COMMENTS, LEDGER_LINE_COMMENT } = require('../models/constants');
const Entry = require('../models/entry');
const Parser = require('../utils/parser');

const trimRight = val => val.trimRight;
const isCommentChar = contained(LEDGER_COMMENTS);
const isLeadingCommentLine = val => isCommentChar(val.slice(0, 1));
const stripLeadingCommentLines = R.reject(isLeadingCommentLine);
const isCommentLine = val => isCommentChar(val.trimLeft().slice(0, 1));
const isNumeric = contained('0123456789');
const isNewTransactionLine = val => isNumeric(val.slice(0, 1));
const isAccountKey = contained(['id', 'account', 'note', 'status', 'address', 'party']);
const lineCommentSpaces = /\; */;
const isCommentToken = R.startsWith(LEDGER_LINE_COMMENT);
const lastTokenIsComment = val => isCommentToken(R.last(val));
const findConnector = R.findIndex(isConnector);
const isNegative = R.startsWith('-');
const parser = new Parser();

function shortcutFromLedgerLine(line) {
  const clean = line.replace(lineCommentSpaces, ';').replace(/@@/g, '=');
  return parser.tokenizeShortcut(clean).chain(({ tokens, comment }) => {
    let parts = R.clone(tokens);
    const account = parts.shift().trim();
    const pair = {};
    let type = 'trades';

    if (parts.length <= 3) {
      // in Ledger format, a single posting could be a credit
      // if it is negative
      if (isNegative(parts[0])) {
        type = 'credits';
        parts[0] = parts[0].slice(1); // strip the negative
      } else {
        type = 'debits';
      }
    }

    const connectorIx = findConnector(parts);
    if (connectorIx > -1) {
      parts = R.insert(connectorIx, account, parts);
    } else {
      parts.push(account);
    }
    const shortcut = comment ? `${parts.join(' ')} ;${comment}` : parts.join(' ');
    return Result.Ok({ type, shortcut });
  });
}

function ledgerTransactionToObject(lines) {
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
  const notes = [];
  const props = {};
  const entryLines = [];
  // process comment lines first, so that all we will have left are entries
  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (line.length > 0) {
      if (!isLeadingCommentLine(line)) {
        entryLines.push(line);
      } else {
        const linetext = line.slice(1);
        if (line.indexOf(':') === -1) {
          notes.push(linetext);
        } else {
          const parts = linetext.split(':');
          const key = parts[0].toLowerCase().trim();
          const val = parts.slice(1).join(':').trim();
          if (key === 'notes') {
            notes.push(val);
          } else if (isAccountKey(key)) {
            props[key] = val;
          } else {
            extra[key] = val;
          }
        }
      }
    }
  });
  // check to see if we have a default account
  if (entryLines.length > 0) {
    const lastLine = entryLines[entryLines.length - 1];
    if (lastLine.trim().indexOf(' ') === -1) {
      // yes, this is an "elided" Ledger entry
      props.account = entryLines.pop();
    }
  }

  const entries = {
    credits: [],
    debits: [],
    trades: []
  };

  const errors = [];
  const addEntry = entry => {
    const val = entry.merge();
    entries[val.type].push(val.shortcut);
  };

  const addError = entry => {
    const val = entry.merge();
    log.error('Err', val);
    errors.push(val);
  };

  entryLines.forEach(line => {
    shortcutFromLedgerLine(line).matchWith({
      Ok: addEntry,
      Error: addError
    });
  });

  return _extends({}, props, {
    utc,
    status,
    party,
    note: notes.join('\n'),
    extra,
    errors
  }, entries);
}

function convertLedgerTransaction(lines) {
  return new Transaction(ledgerTransactionToObject(lines));
}

function splitLedgerTransactions(raw) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const linesets = [];
  let accum = [];

  stripLeadingCommentLines(lines).forEach(line => {
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
  return linesets;
}

function loadLedgerTransactions(raw) {
  return splitLedgerTransactions(raw).map(convertLedgerTransaction);
}

function loadObjectsFromString(raw) {
  return splitLedgerTransactions(raw).map(ledgerTransactionToObject);
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
  ledgerTransactionToObject,
  loadObjectsFromString,
  loadTransactionsFromFilenameSync,
  loadLedgerTransactions,
  convertLedgerTransaction
};
//# sourceMappingURL=ledger_loader.js.map
