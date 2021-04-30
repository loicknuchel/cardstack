#!/usr/bin/env node

/* eslint no-process-exit: "off", node/shebang: "off" */

import yargs from 'yargs';
import fetch from 'node-fetch';
import bridge from './bridge.js';
import viewSafes from './view-safes.js';
import createPrepaidCard from './create-prepaid-card.js';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

type Commands = 'bridge' | 'safesView' | 'prepaidCardCreate';

let command: Commands | undefined;
interface Options {
  network: string;
  mnemonic: string;
  tokenAddress?: string;
  amount?: number;
  address?: string;
  safeAddress?: string;
  amounts?: number[];
}
const { network, mnemonic = process.env.MNEMONIC_PHRASE, tokenAddress, amount, address, safeAddress, amounts } = yargs(
  process.argv.slice(2)
)
  .scriptName('cardpay')
  .usage('Usage: $0 <command> [options]')
  .command('bridge <tokenAddress> <amount>', 'Bridge tokens to the layer 2 network', (yargs) => {
    yargs.positional('tokenAddress', {
      type: 'string',
      default: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // Kovan DAI
      description: 'The token address (defaults to Kovan DAI)',
    });
    yargs.positional('amount', {
      type: 'number',
      description: 'Amount of tokens you would like bridged (*not* in units of wei)',
    });
    command = 'bridge';
  })
  .command(
    'safes-view [address]',
    'View contents of the safes owned by the specified address (or default wallet account)',
    (yargs) => {
      yargs.positional('address', {
        type: 'string',
        description: "The address of the safe owner. This defaults to your wallet's default account when not provided",
      });
      command = 'safesView';
    }
  )
  .command(
    'prepaidcard-create <safeAddress> <tokenAddress> <amounts..>',
    'Create prepaid cards using the specified token from the specified safe with the amounts provided',
    (yargs) => {
      yargs.positional('safeAddress', {
        type: 'string',
        description: 'The address of the safe whose funds to use to create the prepaid cards',
      });
      yargs.positional('tokenAddress', {
        type: 'string',
        default: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // Kovan DAI
        description: 'The token address (defaults to Kovan DAI)',
      });
      yargs.positional('amounts', {
        type: 'string',
        description: 'The amount of tokens used to create each prepaid card (*not* in units of wei)',
      });
      command = 'prepaidCardCreate';
    }
  )
  .options({
    network: {
      alias: 'n',
      type: 'string',
      description: "The Layer 1 network to ruin this script in ('kovan' or 'mainnet')",
    },
    mnemonic: {
      alias: 'm',
      type: 'string',
      description: 'Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE',
    },
  })
  .demandOption(['network'], `'network' must be specified.`)
  .demandCommand(1, 'Please specify a command')
  .help().argv as Options;

if (!mnemonic) {
  yargs.showHelp(
    'No mnemonic is defined, either specify the mnemonic as a positional arg or pass it in using the MNEMONIC_PHRASE env var'
  );
  process.exit(1);
}

if (!command) {
  throw new Error('missing command--should never get here');
}

(async () => {
  switch (command) {
    case 'bridge':
      if (amount == null) {
        yargs.showHelp('amount is a required value');
        process.exit(1);
      }
      await bridge(network, mnemonic, amount, tokenAddress);
      break;
    case 'safesView':
      await viewSafes(network, mnemonic, address);
      break;
    case 'prepaidCardCreate':
      if (safeAddress == null || amounts == null) {
        yargs.showHelp('safeAddress and amounts are required values');
        process.exit(1);
      }
      await createPrepaidCard(network, mnemonic, safeAddress, amounts, tokenAddress);
      break;
    default:
      assertNever(command);
  }
  process.exit(0);
})().catch((e) => {
  console.error(`Error: ${e}`);
  process.exit(1);
});

function assertNever(_value: never): never {
  throw new Error(`not never`);
}
