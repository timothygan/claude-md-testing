import chalk from 'chalk';
import { TestDatabase } from '../../storage/database';
import Table from 'cli-table3';

export interface CompareCommandArgs {
  files: string[];
  verbose?: boolean;
}

export async function compareCommand(args: CompareCommandArgs) {
  const { files, verbose } = args;
  
  try {
    const db = new TestDatabase();
    
    // Resolve file names/IDs to actual files
    const claudeFiles = [];
    for (const file of files) {
      let claudeFile;
      if (isNumeric(file)) {
        claudeFile = await db.getClaudeFile(parseInt(file));
      } else {
        claudeFile = await db.getClaudeFileByName(file);
      }
      
      if (!claudeFile) {
        throw new Error(`CLAUDE.md file not found: ${file}`);
      }
      claudeFiles.push(claudeFile);
    }
    
    console.log(chalk.bold('CLAUDE.md File Comparison'));
    console.log();
    
    // Get comparison data from database
    const fileIds = claudeFiles.map(f => f.id!);
    const comparisonData = await db.compareClaudeFiles(fileIds);
    
    if (comparisonData.length === 0) {
      console.log(chalk.yellow('No test results found for these files.'));
      console.log('Run tests first: claude-test run --claude-file <name> --suite <suite>');
      return;
    }
    
    // Group data by file
    const groupedData = new Map<number, any[]>();
    comparisonData.forEach(row => {
      if (!groupedData.has(row.claude_file_id)) {
        groupedData.set(row.claude_file_id, []);
      }
      groupedData.get(row.claude_file_id)!.push(row);
    });
    
    // Display comparison table
    const table = new Table({
      head: ['File', 'Correctness', 'Speed', 'Token Eff.', 'Code Quality', 'Avg Tokens', 'Avg Time (ms)'],
      colWidths: [15, 12, 8, 12, 12, 12, 15]
    });
    
    claudeFiles.forEach(file => {
      const fileData = groupedData.get(file.id!) || [];
      if (fileData.length === 0) {
        table.push([
          file.name,
          chalk.gray('N/A'),
          chalk.gray('N/A'),
          chalk.gray('N/A'),
          chalk.gray('N/A'),
          chalk.gray('N/A'),
          chalk.gray('N/A')
        ]);
      } else {
        // Calculate averages across all test runs for this file
        const avgCorrectness = (fileData.reduce((sum, d) => sum + (d.avg_correctness || 0), 0) / fileData.length).toFixed(1);
        const avgSpeed = (fileData.reduce((sum, d) => sum + (d.avg_speed || 0), 0) / fileData.length).toFixed(1);
        const avgTokenEff = (fileData.reduce((sum, d) => sum + (d.avg_token_efficiency || 0), 0) / fileData.length).toFixed(1);
        const avgQuality = (fileData.reduce((sum, d) => sum + (d.avg_code_quality || 0), 0) / fileData.length).toFixed(1);
        const avgTokens = Math.round(fileData.reduce((sum, d) => sum + (d.avg_tokens_used || 0), 0) / fileData.length);
        const avgTime = Math.round(fileData.reduce((sum, d) => sum + (d.avg_response_time || 0), 0) / fileData.length);
        
        table.push([
          file.name,
          colorScore(parseFloat(avgCorrectness)),
          colorScore(parseFloat(avgSpeed)),
          colorScore(parseFloat(avgTokenEff)),
          colorScore(parseFloat(avgQuality)),
          avgTokens.toLocaleString(),
          avgTime.toLocaleString()
        ]);
      }
    });
    
    console.log(table.toString());
    console.log();
    
    // Show file details
    if (verbose) {
      console.log(chalk.bold('File Details:'));
      claudeFiles.forEach(file => {
        console.log(chalk.blue(`${file.name}:`));
        console.log(chalk.gray(`  ID: ${file.id}`));
        console.log(chalk.gray(`  Hash: ${file.hash.slice(0, 12)}...`));
        console.log(chalk.gray(`  Created: ${file.createdAt.toLocaleDateString()}`));
        if (file.description) {
          console.log(chalk.gray(`  Description: ${file.description}`));
        }
        console.log();
      });
    }
    
    // Show recommendations
    const bestFile = findBestFile(groupedData, claudeFiles);
    if (bestFile) {
      console.log(chalk.bold.green('Recommendation:'));
      console.log(`The "${bestFile.name}" configuration shows the best overall performance.`);
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

function colorScore(score: number): string {
  if (score >= 8) return chalk.green(`${score}/10`);
  if (score >= 6) return chalk.yellow(`${score}/10`);
  return chalk.red(`${score}/10`);
}

function findBestFile(groupedData: Map<number, any[]>, claudeFiles: any[]): any {
  let bestFile = null;
  let bestScore = -1;
  
  claudeFiles.forEach(file => {
    const fileData = groupedData.get(file.id!) || [];
    if (fileData.length === 0) return;
    
    // Calculate overall score
    const avgCorrectness = fileData.reduce((sum, d) => sum + (d.avg_correctness || 0), 0) / fileData.length;
    const avgSpeed = fileData.reduce((sum, d) => sum + (d.avg_speed || 0), 0) / fileData.length;
    const avgTokenEff = fileData.reduce((sum, d) => sum + (d.avg_token_efficiency || 0), 0) / fileData.length;
    const avgQuality = fileData.reduce((sum, d) => sum + (d.avg_code_quality || 0), 0) / fileData.length;
    
    // Weighted overall score (correctness is most important)
    const overallScore = (avgCorrectness * 0.4) + (avgSpeed * 0.2) + (avgTokenEff * 0.2) + (avgQuality * 0.2);
    
    if (overallScore > bestScore) {
      bestScore = overallScore;
      bestFile = file;
    }
  });
  
  return bestFile;
}