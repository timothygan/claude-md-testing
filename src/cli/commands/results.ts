import chalk from 'chalk';
import { TestDatabase } from '../../storage/database';
import Table from 'cli-table3';

export interface ResultsCommandArgs {
  'run-id'?: number;
  latest?: boolean;
  format: 'table' | 'json' | 'markdown';
  verbose?: boolean;
}

export async function resultsCommand(args: ResultsCommandArgs) {
  const { 'run-id': runId, latest, format, verbose } = args;
  
  try {
    const db = new TestDatabase();
    
    let targetRunId: number;
    
    if (latest) {
      const runs = await db.listTestRuns();
      if (runs.length === 0) {
        throw new Error('No test runs found');
      }
      targetRunId = runs[0].id!;
    } else if (runId) {
      targetRunId = runId;
    } else {
      throw new Error('Must specify either --run-id or --latest');
    }
    
    // Get test run and results
    const testRun = await db.getTestRun(targetRunId);
    if (!testRun) {
      throw new Error(`Test run not found: ${targetRunId}`);
    }
    
    const results = await db.getTestResults(targetRunId);
    const claudeFile = await db.getClaudeFile(testRun.claudeFileId);
    
    // Display results in requested format
    switch (format) {
      case 'table':
        displayTableFormat(testRun, claudeFile!, results);
        break;
      case 'json':
        console.log(JSON.stringify({
          testRun,
          claudeFile,
          results
        }, null, 2));
        break;
      case 'markdown':
        displayMarkdownFormat(testRun, claudeFile!, results);
        break;
    }
    
    db.close();
    
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function displayTableFormat(testRun: any, claudeFile: any, results: any[]) {
  console.log(chalk.bold('Test Run Results'));
  console.log(chalk.gray(`Run ID: ${testRun.id}`));
  console.log(chalk.gray(`CLAUDE File: ${claudeFile.name} (${claudeFile.hash.slice(0, 8)}...)`));
  console.log(chalk.gray(`Started: ${testRun.startedAt}`));
  console.log(chalk.gray(`Completed: ${testRun.completedAt || 'N/A'}`));
  console.log();
  
  // Summary scores table
  const summaryTable = new Table({
    head: ['Test ID', 'Correctness', 'Speed', 'Tokens', 'Quality', 'Overall'],
    colWidths: [20, 12, 8, 8, 10, 10]
  });
  
  results.forEach(result => {
    const scores = result.scores;
    const overall = (Object.values(scores).reduce((a, b) => (a as number) + (b as number), 0) / Object.keys(scores).length).toFixed(1);
    
    summaryTable.push([
      result.testId,
      colorScore(scores.correctness),
      colorScore(scores.speed),
      colorScore(scores.tokenEfficiency),
      colorScore(scores.codeQuality),
      colorScore(parseFloat(overall))
    ]);
  });
  
  console.log(summaryTable.toString());
  console.log();
  
  // Detailed metrics table
  const metricsTable = new Table({
    head: ['Metric', 'Average', 'Best', 'Worst'],
    colWidths: [20, 10, 10, 10]
  });
  
  const metricNames = Object.keys(results[0]?.scores || {});
  metricNames.forEach(metric => {
    const values = results.map(r => r.scores[metric]);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    const best = Math.max(...values).toFixed(1);
    const worst = Math.min(...values).toFixed(1);
    
    metricsTable.push([
      metric,
      colorScore(parseFloat(avg)),
      colorScore(parseFloat(best)),
      colorScore(parseFloat(worst))
    ]);
  });
  
  console.log(chalk.bold('Detailed Metrics:'));
  console.log(metricsTable.toString());
}

function displayMarkdownFormat(testRun: any, claudeFile: any, results: any[]) {
  console.log(`# Test Run Results`);
  console.log();
  console.log(`**Run ID:** ${testRun.id}`);
  console.log(`**CLAUDE File:** ${claudeFile.name} (${claudeFile.hash.slice(0, 8)}...)`);
  console.log(`**Started:** ${testRun.startedAt}`);
  console.log(`**Completed:** ${testRun.completedAt || 'N/A'}`);
  console.log();
  
  console.log(`## Test Results`);
  console.log();
  console.log(`| Test ID | Correctness | Speed | Token Efficiency | Code Quality | Overall |`);
  console.log(`|---------|-------------|--------|------------------|---------------|---------|`);
  
  results.forEach(result => {
    const scores = result.scores;
    const overall = (Object.values(scores).reduce((a, b) => (a as number) + (b as number), 0) / Object.keys(scores).length).toFixed(1);
    
    console.log(`| ${result.testId} | ${scores.correctness}/10 | ${scores.speed}/10 | ${scores.tokenEfficiency}/10 | ${scores.codeQuality}/10 | ${overall}/10 |`);
  });
  
  console.log();
  console.log(`## Metrics Summary`);
  console.log();
  
  const metricNames = Object.keys(results[0]?.scores || {});
  metricNames.forEach(metric => {
    const values = results.map(r => r.scores[metric]);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    console.log(`**${metric}:** ${avg}/10`);
  });
}

function colorScore(score: number): string {
  if (score >= 8) return chalk.green(`${score}/10`);
  if (score >= 6) return chalk.yellow(`${score}/10`);
  return chalk.red(`${score}/10`);
}