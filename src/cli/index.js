#! /usr/bin/env node
/**
CLI for Crypto-Accounting

Copyright (c) 2018 Bruce Kroeze
*/

require('dotenv').config();
const R = require('ramda');
const commands = require('./commands');
const getVal = require('../utils/env').getVal;

const USAGE = 'Crypto-Accounting CLI\nUsage: cryptoacc [command]';

function execute() {
  const defaultLevel = getVal('LOGLEVEL', 'ERROR');

  var args = require('yargs')
      .usage(USAGE);

  const makeCmd = cmd => args.command(cmd);

  R.map(makeCmd, commands);

  args.showHelpOnFail(false, 'Specify --help for available options')
    .demandCommand(1, USAGE + '\n\nI need at least one command, such as "adduser"')
    .help()
    .strict()
    .parse();
}

module.exports = {
  execute
};
