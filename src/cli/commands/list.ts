import chalk from 'chalk';
import { TestDatabase } from '../../storage/database';
import Table from 'cli-table3';

export interface ListCommandArgs {
  type: 'files' | 'runs' | 'suites';
  verbose?: boolean;
}

export async function listCommand(args: ListCommandArgs) {
  const { type, verbose } = args;
  
  try {
    const db = new TestDatabase();
    
    switch (type) {
      case 'files':
        await listClaudeFiles(db, verbose);
        break;
      case 'runs':
        await listTestRuns(db, verbose);
        break;
      case 'suites':
        await listTestSuites(db, verbose);
        break;
    }
    
    db.close();
    
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function listClaudeFiles(db: TestDatabase, verbose?: boolean) {
  const files = await db.listClaudeFiles();
  
  if (files.length === 0) {
    console.log(chalk.yellow('No CLAUDE.md files found.'));
    console.log('Run: claude-test add --file <path> --name <name>');
    return;
  }
  
  console.log(chalk.bold('CLAUDE.md Files:'));
  console.log();
  
  const table = new Table({
    head: ['ID', 'Name', 'Hash', 'Created', 'Description'],
    colWidths: [5, 20, 12, 20, 30]
  });
  
  files.forEach(file => {
    table.push([
      file.id?.toString() || '',
      file.name,
      file.hash.slice(0, 8) + '...',
      file.createdAt.toLocaleDateString(),
      (file.description || '').slice(0, 25) + (file.description && file.description.length > 25 ? '...' : '')
    ]);
  });
  
  console.log(table.toString());
}

async function listTestRuns(db: TestDatabase, verbose?: boolean) {
  const runs = await db.listTestRuns();
  
  if (runs.length === 0) {
    console.log(chalk.yellow('No test runs found.'));
    console.log('Run: claude-test run --claude-file <name> --suite <suite>');
    return;
  }
  
  console.log(chalk.bold('Test Runs:'));
  console.log();
  
  const table = new Table({
    head: ['Run ID', 'CLAUDE File ID', 'Test Suite', 'Started', 'Status'],
    colWidths: [8, 15, 15, 20, 12]
  });
  
  runs.forEach(run => {
    const statusColor = run.status === 'completed' ? chalk.green : 
                       run.status === 'failed' ? chalk.red : 
                       chalk.yellow;
    
    table.push([
      run.id?.toString() || '',
      run.claudeFileId.toString(),
      run.testSuiteVersion,
      run.startedAt.toLocaleString(),
      statusColor(run.status)
    ]);
  });
  
  console.log(table.toString());
}

async function listTestSuites(db: TestDatabase, verbose?: boolean) {
  // For now, just list the known test suites since we don't have a comprehensive query
  const knownSuites = ['basic', 'advanced'];
  
  console.log(chalk.bold('Available Test Suites:'));
  console.log();
  
  for (const suiteId of knownSuites) {
    const suite = await db.getTestSuite(suiteId);
    if (suite) {
      console.log(chalk.green('✓'), chalk.bold(suite.name));
      console.log(chalk.gray(`  ID: ${suite.id}`));
      console.log(chalk.gray(`  Version: ${suite.version}`));
      console.log(chalk.gray(`  Tests: ${suite.tests.length}`));
      if (suite.description) {
        console.log(chalk.gray(`  Description: ${suite.description}`));
      }
      console.log();
    }
  }
}