import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { TestDatabase } from '../../storage/database';

export interface ExportCommandArgs {
  'run-id'?: number;
  'claude-file'?: string;
  latest?: boolean;
  format: 'json' | 'markdown' | 'html';
  output?: string;
  verbose?: boolean;
}

export async function exportCommand(args: ExportCommandArgs) {
  const { 'run-id': runId, 'claude-file': claudeFileName, latest, format, output, verbose } = args;
  
  try {
    const db = new TestDatabase();
    
    let testRuns: any[] = [];
    
    if (runId) {
      // Export specific run
      const run = await db.getTestRun(runId);
      if (!run) {
        throw new Error(`Test run not found: ${runId}`);
      }
      testRuns = [run];
    } else if (claudeFileName) {
      // Export all runs for a specific CLAUDE.md file
      let claudeFile;
      if (isNumeric(claudeFileName)) {
        claudeFile = await db.getClaudeFile(parseInt(claudeFileName));
      } else {
        claudeFile = await db.getClaudeFileByName(claudeFileName);
      }
      
      if (!claudeFile) {
        throw new Error(`CLAUDE.md file not found: ${claudeFileName}`);
      }
      
      testRuns = await db.listTestRuns(claudeFile.id);
    } else if (latest) {
      // Export latest run
      const runs = await db.listTestRuns();
      if (runs.length === 0) {
        throw new Error('No test runs found');
      }
      testRuns = [runs[0]];
    } else {
      throw new Error('Must specify --run-id, --claude-file, or --latest');
    }
    
    // Create results directory structure
    const resultsDir = './results';
    await fs.mkdir(resultsDir, { recursive: true });
    
    // Process each test run
    for (const testRun of testRuns) {
      const claudeFile = await db.getClaudeFile(testRun.claudeFileId);
      const results = await db.getTestResults(testRun.id);
      
      if (!claudeFile) {
        console.warn(`Claude file not found for run ${testRun.id}`);
        continue;
      }
      
      const exportData = {
        testRun,
        claudeFile: {
          name: claudeFile.name,
          description: claudeFile.description,
          hash: claudeFile.hash,
          createdAt: claudeFile.createdAt
        },
        results,
        summary: calculateSummary(results),
        exportedAt: new Date().toISOString()
      };
      
      // Generate filename
      const timestamp = testRun.startedAt.toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = output || `${claudeFile.name}_run-${testRun.id}_${timestamp}.${format}`;
      const filePath = path.join(resultsDir, filename);
      
      // Generate content based on format
      let content: string;
      switch (format) {
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          break;
        case 'markdown':
          content = generateMarkdownReport(exportData);
          break;
        case 'html':
          content = generateHtmlReport(exportData);
          break;
      }
      
      // Write file
      await fs.writeFile(filePath, content, 'utf-8');
      
      console.log(chalk.green('✓'), `Exported: ${path.resolve(filePath)}`);
      if (verbose) {
        console.log(chalk.gray(`  Run ID: ${testRun.id}`));
        console.log(chalk.gray(`  Tests: ${results.length}`));
        console.log(chalk.gray(`  Format: ${format}`));
      }
    }
    
    db.close();
    
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function isNumeric(str: string): boolean {
  return !isNaN(parseFloat(str)) && isFinite(parseFloat(str));
}

function calculateSummary(results: any[]) {
  const totalTests = results.length;
  const failedTests = results.filter(r => r.scores.correctness === 0).length;
  const passedTests = totalTests - failedTests;
  
  const avgScores: any = {};
  const metricNames = Object.keys(results[0]?.scores || {});
  
  metricNames.forEach(metric => {
    const values = results.map(r => r.scores[metric]);
    avgScores[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
  });
  
  const totalTokens = results.reduce((sum, r) => 
    sum + r.tokensInput + r.tokensOutput + (r.tokensThinking || 0), 0
  );
  
  const totalTime = results.reduce((sum, r) => sum + r.responseTimeMs, 0);
  
  return {
    totalTests,
    passedTests,
    failedTests,
    successRate: totalTests > 0 ? passedTests / totalTests : 0,
    averageScores: avgScores,
    totalTokensUsed: totalTokens,
    totalTimeMs: totalTime
  };
}

function generateMarkdownReport(data: any): string {
  const { testRun, claudeFile, results, summary } = data;
  
  let md = `# Test Results Report\n\n`;
  md += `**CLAUDE File:** ${claudeFile.name}\n`;
  md += `**Run ID:** ${testRun.id}\n`;
  md += `**Started:** ${testRun.startedAt}\n`;
  md += `**Completed:** ${testRun.completedAt || 'N/A'}\n`;
  md += `**Status:** ${testRun.status}\n\n`;
  
  if (claudeFile.description) {
    md += `**Description:** ${claudeFile.description}\n\n`;
  }
  
  md += `## Summary\n\n`;
  md += `- **Total Tests:** ${summary.totalTests}\n`;
  md += `- **Passed:** ${summary.passedTests}\n`;
  md += `- **Failed:** ${summary.failedTests}\n`;
  md += `- **Success Rate:** ${(summary.successRate * 100).toFixed(1)}%\n`;
  md += `- **Total Tokens:** ${summary.totalTokensUsed.toLocaleString()}\n`;
  md += `- **Total Time:** ${Math.round(summary.totalTimeMs / 1000)}s\n\n`;
  
  md += `## Average Scores\n\n`;
  Object.entries(summary.averageScores).forEach(([metric, score]: [string, any]) => {
    md += `- **${metric}:** ${score.toFixed(1)}/10\n`;
  });
  
  md += `\n## Individual Test Results\n\n`;
  md += `| Test ID | Correctness | Speed | Token Eff. | Code Quality | Overall |\n`;
  md += `|---------|-------------|-------|-------------|--------------|----------|\n`;
  
  results.forEach((result: any) => {
    const overall = (Object.values(result.scores).reduce((a: any, b: any) => a + b, 0) / Object.keys(result.scores).length).toFixed(1);
    md += `| ${result.testId} | ${result.scores.correctness}/10 | ${result.scores.speed}/10 | ${result.scores.tokenEfficiency}/10 | ${result.scores.codeQuality}/10 | ${overall}/10 |\n`;
  });
  
  md += `\n## Test Details\n\n`;
  results.forEach((result: any) => {
    md += `### ${result.testId}\n\n`;
    md += `**Prompt:** ${result.prompt}\n\n`;
    md += `**Response Time:** ${result.responseTimeMs}ms\n`;
    md += `**Tokens:** ${result.tokensInput} in, ${result.tokensOutput} out\n\n`;
    md += `**Response:**\n\`\`\`\n${result.response.slice(0, 500)}${result.response.length > 500 ? '...' : ''}\n\`\`\`\n\n`;
    md += `**Scores:**\n`;
    Object.entries(result.scores).forEach(([metric, score]: [string, any]) => {
      md += `- ${metric}: ${score}/10\n`;
    });
    md += `\n`;
  });
  
  md += `\n---\n*Report generated on ${data.exportedAt}*\n`;
  
  return md;
}

function generateHtmlReport(data: any): string {
  const { testRun, claudeFile, results, summary } = data;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Results - ${claudeFile.name}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .score { font-size: 24px; font-weight: bold; color: #28a745; }
        .score.medium { color: #ffc107; }
        .score.low { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .test-detail { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .response { background: #fff; border: 1px solid #ddd; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; max-height: 200px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Test Results Report</h1>
        <p><strong>CLAUDE File:</strong> ${claudeFile.name}</p>
        <p><strong>Run ID:</strong> ${testRun.id} | <strong>Started:</strong> ${testRun.startedAt}</p>
        ${claudeFile.description ? `<p><strong>Description:</strong> ${claudeFile.description}</p>` : ''}
    </div>
    
    <h2>Summary</h2>
    <div class="metric-grid">
        <div class="metric-card">
            <div class="score">${summary.totalTests}</div>
            <div>Total Tests</div>
        </div>
        <div class="metric-card">
            <div class="score">${summary.passedTests}</div>
            <div>Passed</div>
        </div>
        <div class="metric-card">
            <div class="score">${(summary.successRate * 100).toFixed(1)}%</div>
            <div>Success Rate</div>
        </div>
        <div class="metric-card">
            <div class="score">${summary.totalTokensUsed.toLocaleString()}</div>
            <div>Total Tokens</div>
        </div>
    </div>
    
    <h2>Average Scores</h2>
    <div class="metric-grid">
        ${Object.entries(summary.averageScores).map(([metric, score]: [string, any]) => `
        <div class="metric-card">
            <div class="score ${score >= 8 ? '' : score >= 6 ? 'medium' : 'low'}">${score.toFixed(1)}/10</div>
            <div>${metric}</div>
        </div>
        `).join('')}
    </div>
    
    <h2>Test Results</h2>
    <table>
        <thead>
            <tr>
                <th>Test ID</th>
                <th>Correctness</th>
                <th>Speed</th>
                <th>Token Efficiency</th>
                <th>Code Quality</th>
                <th>Overall</th>
            </tr>
        </thead>
        <tbody>
            ${results.map((result: any) => {
                const overall = (Object.values(result.scores).reduce((a: any, b: any) => a + b, 0) / Object.keys(result.scores).length).toFixed(1);
                return `
                <tr>
                    <td>${result.testId}</td>
                    <td>${result.scores.correctness}/10</td>
                    <td>${result.scores.speed}/10</td>
                    <td>${result.scores.tokenEfficiency}/10</td>
                    <td>${result.scores.codeQuality}/10</td>
                    <td>${overall}/10</td>
                </tr>
                `;
            }).join('')}
        </tbody>
    </table>
    
    <h2>Test Details</h2>
    ${results.map((result: any) => `
    <div class="test-detail">
        <h3>${result.testId}</h3>
        <p><strong>Prompt:</strong> ${result.prompt}</p>
        <p><strong>Response Time:</strong> ${result.responseTimeMs}ms | <strong>Tokens:</strong> ${result.tokensInput} in, ${result.tokensOutput} out</p>
        <p><strong>Response:</strong></p>
        <div class="response">${result.response.slice(0, 1000)}${result.response.length > 1000 ? '...' : ''}</div>
    </div>
    `).join('')}
    
    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
        <small>Report generated on ${data.exportedAt}</small>
    </footer>
</body>
</html>`;
}