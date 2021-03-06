/* eslint no-unused-vars: off */

import * as R from 'ramda';
import * as Result from 'folktale/result';
import { contained } from 'ramda-adjunct';
import path from 'path';
import * as Logger from 'js-logger';
import { getFS } from './common';
import { splitAndTrim, isTime, isConnector } from '../utils/models';
import { Transaction } from '../models/transaction';
import { isRelativePath } from '../utils/files';
import { LEDGER_COMMENTS, LEDGER_LINE_COMMENT } from '../models/constants';
import { Entry } from '../models/entry';
import { Parser } from '../utils/parser';

const log = Logger.get('ledger_loader');

const trimRight = val => val.trimRight;
const isCommentChar = contained(LEDGER_COMMENTS);
const isLeadingCommentLine = val => isCommentChar(val.slice(0, 1));
const stripLeadingCommentLines = R.reject(isLeadingCommentLine);
const isCommentLine = val => isCommentChar(val.trimLeft().slice(0, 1));
const isNumeric = contained('0123456789');
const isNewTransactionLine = val => isNumeric(val.slice(0, 1));
const isAccountKey = contained(['id', 'account', 'note', 'status', 'address', 'party']);
const lineCommentSpaces = /; */;
const isCommentToken = R.startsWith(LEDGER_LINE_COMMENT);
const lastTokenIsComment = val => isCommentToken(R.last(val));
const findConnector = R.findIndex(isConnector);
const isNegative = R.startsWith('-');
const parser = new Parser();

export function shortcutFromLedgerLine(line) {
  const clean = line
    .replace(lineCommentSpaces, ';')
    .replace(/@@/g, '=');
  return parser.tokenizeShortcut(clean)
    .chain(({ tokens, comment }) => {
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

export function ledgerTransactionToObject(lines) {
  const header = splitAndTrim(lines.shift());
  // get the utc, replacing / with -.
  let utc = header.shift().split('/').join('-');
  let status = '';

  // has time?
  if (header[0].length > 1 && isTime(header[0])) {
    utc = `${utc}T${header.shift()}:000Z`;
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
  lines.forEach((rawLine) => {
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
    trades: [],
  };

  const errors = [];
  const addEntry = (entry) => {
    const val = entry.merge();
    entries[val.type].push(val.shortcut);
  };

  const addError = (entry) => {
    const val = entry.merge();
    log.error('Err', val);
    errors.push(val);
  };

  entryLines.forEach((line) => {
    shortcutFromLedgerLine(line)
      .matchWith({
        Ok: addEntry,
        Error: addError,
      });
  });

  return {
    ...props,
    utc,
    status,
    party,
    note: notes.join('\n'),
    extra,
    errors,
    ...entries,
  };
}

export function convertLedgerTransaction(lines) {
  return new Transaction(ledgerTransactionToObject(lines));
}

function splitLedgerTransactions(raw) {
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
  return linesets;
}

export function loadLedgerTransactions(raw) {
  return splitLedgerTransactions(raw)
    .map(convertLedgerTransaction);
}

export function loadObjectsFromString(raw) {
  return splitLedgerTransactions(raw)
    .map(ledgerTransactionToObject);
}

export function loadTransactionsFromFilenameSync(fname, directory) {
  let link = fname;
  if (directory && isRelativePath(fname)) {
    link = path.normalize(`${directory}/${fname}`);
  }
  return loadLedgerTransactions(getFS().readFileSync(link, 'utf-8'));
}
