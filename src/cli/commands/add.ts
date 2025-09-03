import * as fs from 'fs';
import chalk from 'chalk';
import { TestDatabase } from '../../storage/database';

export interface AddCommandArgs {
  file: string;
  name: string;
  description?: string;
  verbose?: boolean;
}

export async function addCommand(args: AddCommandArgs) {
  const { file, name, description, verbose } = args;
  
  try {
    // Check if file exists
    if (!fs.existsSync(file)) {
      throw new Error(`File not found: ${file}`);
    }
    
    // Read the CLAUDE.md content
    const content = fs.readFileSync(file, 'utf-8');
    
    if (verbose) {
      console.log(chalk.blue('Info:'), `Reading file: ${file}`);
      console.log(chalk.blue('Info:'), `Content length: ${content.length} characters`);
    }
    
    // Initialize database
    const db = new TestDatabase();
    
    // Add the CLAUDE file
    const claudeFile = await db.saveClaudeFile({
      name,
      content,
      description
    });
    
    console.log(chalk.green('✓'), `Added CLAUDE.md file: ${chalk.bold(name)}`);
    console.log(chalk.gray(`  ID: ${claudeFile.id}`));
    console.log(chalk.gray(`  Hash: ${claudeFile.hash.slice(0, 8)}...`));
    
    if (description) {
      console.log(chalk.gray(`  Description: ${description}`));
    }
    
    console.log(chalk.gray(`  Created: ${claudeFile.createdAt.toISOString()}`));
    
    db.close();
    
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}