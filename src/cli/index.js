#! /usr/bin/env node
/**
CLI for Crypto-Accounting

Copyright (c) 2018 Bruce Kroeze
*/

import yargs from 'yargs';
import dotenv from 'dotenv';
import commands from './commands';
// import { getVal } from '../utils/env';

dotenv.config();

const USAGE = 'Crypto-Accounting CLI\nUsage: cryptoacc [command]';

export function execute() {
  // const defaultLevel = getVal('LOGLEVEL', 'ERROR');

  const args = yargs.usage(USAGE);

  const makeCmd = cmd => args.command(cmd);

  commands.forEach(makeCmd);

  args.showHelpOnFail(false, 'Specify --help for available options')
    .demandCommand(1, `${USAGE}\n\nI need at least one command, such as "adduser"`)
    .help()
    .strict()
    .parse();
}
