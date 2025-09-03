import chalk from 'chalk';
import { TestDatabase } from '../../storage/database';
import { TestRunner } from '../../runners/test-runner';
import { TestSuite, Test } from '../../types';

export interface RunCommandArgs {
  'claude-file': string;
  suite: string;
  verbose?: boolean;
}

export async function runCommand(args: RunCommandArgs) {
  const { 'claude-file': claudeFileName, suite, verbose } = args;
  
  try {
    // Check if Claude CLI is available
    const { execSync } = require('child_process');
    try {
      execSync('claude --version', { stdio: 'ignore' });
    } catch (error) {
      throw new Error('Claude CLI not found. Please install Claude Code from https://claude.ai/code');
    }
    
    // Initialize database
    const db = new TestDatabase();
    
    // Find the CLAUDE file
    let claudeFile;
    if (isNumeric(claudeFileName)) {
      claudeFile = await db.getClaudeFile(parseInt(claudeFileName));
    } else {
      claudeFile = await db.getClaudeFileByName(claudeFileName);
    }
    
    if (!claudeFile) {
      throw new Error(`CLAUDE.md file not found: ${claudeFileName}`);
    }
    
    // Get test suite
    const testSuite = await db.getTestSuite(suite);
    if (!testSuite) {
      throw new Error(`Test suite not found: ${suite}. Run 'claude-test init' to create default test suites.`);
    }
    
    console.log(chalk.blue('Starting test run...'));
    console.log(chalk.gray(`CLAUDE file: ${claudeFile.name} (${claudeFile.hash.slice(0, 8)}...)`));
    console.log(chalk.gray(`Test suite: ${testSuite.name} (${testSuite.tests.length} tests)`));
    console.log();
    
    // Initialize test runner
    const runner = new TestRunner({
      workspaceDir: process.env.TEST_WORKSPACE_DIR || './test-workspaces',
      timeout: parseInt(process.env.TEST_TIMEOUT || '120000'), // 2 minutes
      useSkipPermissions: process.env.USE_SKIP_PERMISSIONS !== 'false'
    });
    
    // Create test run record
    const testRun = await db.createTestRun(claudeFile.id!, testSuite.version);
    
    // Run tests with progress callbacks
    const { results, summary } = await runner.runTestSuite(
      claudeFile,
      testSuite,
      testRun.id!,
      {
        onTestStart: (test: Test) => {
          if (verbose) {
            console.log(chalk.yellow('→'), `Running: ${test.id}`);
          } else {
            process.stdout.write('.');
          }
        },
        onTestComplete: (test: Test, result) => {
          // Save each result to database
          db.saveTestResult(result);
          
          if (verbose) {
            const avgScore = Object.values(result.scores).reduce((a, b) => a + b, 0) / Object.keys(result.scores).length;
            console.log(chalk.green('✓'), `${test.id} - Avg Score: ${avgScore.toFixed(1)}/10`);
          }
        },
        onProgress: (completed, total) => {
          if (!verbose) {
            if (completed === total) {
              console.log(); // New line after dots
            }
          }
        }
      }
    );
    
    // Update test run as completed
    await db.updateTestRun(testRun.id!, {
      status: 'completed',
      completedAt: new Date()
    });
    
    // Display results
    console.log(chalk.green('\n✓ Test run completed!'));
    console.log(chalk.gray(`Run ID: ${testRun.id}`));
    console.log();
    
    displaySummary(summary);
    
    db.close();
    
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function isNumeric(str: string): boolean {
  return !isNaN(parseFloat(str)) && isFinite(parseFloat(str));
}

function displaySummary(summary: any) {
  console.log(chalk.bold('Test Summary:'));
  console.log(`  Total Tests: ${summary.totalTests}`);
  console.log(`  Passed: ${chalk.green(summary.passedTests)}`);
  console.log(`  Failed: ${chalk.red(summary.failedTests)}`);
  console.log(`  Success Rate: ${chalk.cyan((summary.successRate * 100).toFixed(1) + '%')}`);
  console.log();
  
  console.log(chalk.bold('Average Scores:'));
  Object.entries(summary.averageScores).forEach(([metric, score]) => {
    const color = (score as number) >= 8 ? chalk.green : 
                  (score as number) >= 6 ? chalk.yellow : chalk.red;
    console.log(`  ${metric}: ${color((score as number).toFixed(1))}/10`);
  });
  
  console.log();
  console.log(`Total Tokens Used: ${chalk.cyan(summary.totalTokensUsed.toLocaleString())}`);
  console.log(`Total Time: ${chalk.cyan(Math.round(summary.totalTimeMs / 1000))}s`);
}