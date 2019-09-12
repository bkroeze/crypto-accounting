import * as R from 'ramda';
import convert from './convert';
import prices from './prices';
import loadprices from './loadprices';
import capitalgains from './capitalgains';

const commands = [
  convert.command,
  prices.command,
  loadprices.command,
  capitalgains.command,
];


export default commands;
