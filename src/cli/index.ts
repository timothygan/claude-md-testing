#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { addCommand } from './commands/add';
import { runCommand } from './commands/run';
import { listCommand } from './commands/list';
import { compareCommand } from './commands/compare';
import { resultsCommand } from './commands/results';
import { initCommand } from './commands/init';
import { exportCommand } from './commands/export';

// Load environment variables
dotenv.config();

const cli = yargs(hideBin(process.argv))
  .scriptName('claude-test')
  .usage('$0 <cmd> [args]')
  .command(
    'init',
    'Initialize the database and create sample files',
    {},
    (args: any) => initCommand(args)
  )
  .command(
    'add',
    'Add a new CLAUDE.md file to the test system',
    {
      file: {
        alias: 'f',
        type: 'string',
        demandOption: true,
        description: 'Path to CLAUDE.md file'
      },
      name: {
        alias: 'n',
        type: 'string',
        demandOption: true,
        description: 'Name for this CLAUDE.md version'
      },
      description: {
        alias: 'd',
        type: 'string',
        description: 'Description of this version'
      }
    },
    (args: any) => addCommand(args)
  )
  .command(
    'run',
    'Run tests on a CLAUDE.md file',
    {
      'claude-file': {
        alias: 'c',
        type: 'string',
        demandOption: true,
        description: 'Name or ID of CLAUDE.md file to test'
      },
      suite: {
        alias: 's',
        type: 'string',
        default: 'basic',
        description: 'Test suite to run'
      }
    },
    (args: any) => runCommand(args)
  )
  .command(
    'list',
    'List available CLAUDE.md files and test runs',
    {
      type: {
        alias: 't',
        type: 'string',
        choices: ['files', 'runs', 'suites'],
        default: 'files',
        description: 'What to list'
      }
    },
    (args: any) => listCommand(args)
  )
  .command(
    'compare',
    'Compare multiple CLAUDE.md files',
    {
      files: {
        alias: 'f',
        type: 'array',
        demandOption: true,
        description: 'Names or IDs of CLAUDE.md files to compare'
      }
    },
    (args: any) => compareCommand(args)
  )
  .command(
    'results',
    'View detailed test results',
    {
      'run-id': {
        alias: 'r',
        type: 'number',
        description: 'Test run ID to view'
      },
      latest: {
        alias: 'l',
        type: 'boolean',
        description: 'View latest test run results'
      },
      format: {
        alias: 'f',
        type: 'string',
        choices: ['table', 'json', 'markdown'],
        default: 'table',
        description: 'Output format'
      }
    },
    (args: any) => resultsCommand(args)
  )
  .command(
    'export',
    'Export detailed test results to files',
    {
      'run-id': {
        alias: 'r',
        type: 'number',
        description: 'Test run ID to export'
      },
      'claude-file': {
        alias: 'c',
        type: 'string',
        description: 'Export all runs for this CLAUDE.md file'
      },
      latest: {
        alias: 'l',
        type: 'boolean',
        description: 'Export latest test run'
      },
      format: {
        alias: 'f',
        type: 'string',
        choices: ['json', 'markdown', 'html'],
        default: 'markdown',
        description: 'Export format'
      },
      output: {
        alias: 'o',
        type: 'string',
        description: 'Output filename (optional)'
      }
    },
    (args: any) => exportCommand(args)
  )
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Verbose output'
  })
  .demandCommand(1, 'You need at least one command')
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'V')
  .epilogue('For more information, visit the documentation')
  .fail((msg, err, yargs) => {
    if (err) {
      console.error(chalk.red('Error:'), err.message);
      if (process.env.NODE_ENV === 'development') {
        console.error(err.stack);
      }
    } else {
      console.error(chalk.red('Error:'), msg);
      console.log('\n');
      yargs.showHelp();
    }
    process.exit(1);
  });

// Parse and execute
cli.parse();