import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { TestDatabase } from '../../storage/database';
import { TestSuite } from '../../types';

export interface InitCommandArgs {
  verbose?: boolean;
}

export async function initCommand(args: InitCommandArgs) {
  const { verbose } = args;
  
  try {
    console.log(chalk.blue('Initializing CLAUDE.md testing environment...'));
    
    // Initialize database
    const db = new TestDatabase();
    console.log(chalk.green('✓'), 'Database initialized');
    
    // Create sample directories
    const dirs = ['claude-files', 'tests', 'results'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(chalk.green('✓'), `Created directory: ${dir}`);
      }
    });
    
    // Create sample CLAUDE.md files
    await createSampleClaudeFiles();
    console.log(chalk.green('✓'), 'Created sample CLAUDE.md files');
    
    // Create test suites
    await createTestSuites(db);
    console.log(chalk.green('✓'), 'Created test suites');
    
    // Create sample .env if it doesn't exist
    if (!fs.existsSync('.env')) {
      fs.copyFileSync('.env.example', '.env');
      console.log(chalk.green('✓'), 'Created .env file from template');
      console.log(chalk.blue('ℹ'), 'No API key needed - uses Claude CLI directly');
    }
    
    db.close();
    
    console.log();
    console.log(chalk.bold.green('🎉 Initialization complete!'));
    console.log();
    console.log('Next steps:');
    console.log('1. Make sure Claude Code CLI is installed: https://claude.ai/code');
    console.log('2. Run: claude-test add --file ./claude-files/basic.md --name "basic"');
    console.log('3. Run: claude-test run --claude-file "basic" --suite "basic"');
    
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function createSampleClaudeFiles() {
  const basicClaudeFile = `# CLAUDE.md - Basic Configuration

This file provides guidance to Claude Code when working with code in this repository.

## Instructions

- Always read files before editing them
- Provide clear explanations for code changes
- Follow TypeScript best practices
- Use proper error handling
- Write tests when creating new functionality
- Document complex logic with comments

## Code Style

- Use TypeScript strict mode
- Prefer const over let
- Use descriptive variable names
- Add JSDoc comments for public functions

## Testing

Run tests before submitting code:
\`\`\`bash
npm test
\`\`\`
`;

  const advancedClaudeFile = `# CLAUDE.md - Advanced Configuration

This file provides comprehensive guidance to Claude Code.

## Core Principles

- **Correctness First**: Always prioritize working code over clever solutions
- **Security**: Never expose secrets, validate all inputs
- **Performance**: Consider time and space complexity
- **Maintainability**: Write code that others can understand

## Development Workflow

1. **Read First**: Always read existing code before making changes
2. **Test Driven**: Write tests for new functionality
3. **Incremental**: Make small, focused changes
4. **Document**: Update documentation with code changes

## Code Quality Standards

### TypeScript
- Use strict type checking
- Prefer interfaces over types for object shapes
- Use generics appropriately
- Avoid 'any' type

### Error Handling
- Use Result types or proper exception handling
- Validate inputs at boundaries
- Provide meaningful error messages
- Log errors appropriately

### Security
- Sanitize user inputs
- Use environment variables for secrets
- Validate permissions before operations
- Follow OWASP guidelines

## Architecture

- Follow separation of concerns
- Use dependency injection
- Implement proper abstraction layers
- Consider scalability from the start
`;

  fs.writeFileSync('./claude-files/basic.md', basicClaudeFile);
  fs.writeFileSync('./claude-files/advanced.md', advancedClaudeFile);
}

async function createTestSuites(db: TestDatabase) {
  const basicTestSuite: TestSuite = {
    id: 'basic',
    version: '1.0.0',
    name: 'Basic Functionality Tests',
    description: 'Tests basic coding tasks and file operations',
    tests: [
      {
        id: 'simple-function',
        prompt: 'Write a TypeScript function that takes a string and returns its reverse.',
        category: 'basic-coding',
        expectedBehavior: 'Create a working string reversal function with proper TypeScript types',
        timeout: 30000
      },
      {
        id: 'file-read-write',
        prompt: 'Create a simple TypeScript utility that reads a JSON file and adds a timestamp field.',
        category: 'file-operations',
        expectedBehavior: 'Read file, parse JSON, add timestamp, write back to file',
        timeout: 45000
      },
      {
        id: 'error-handling',
        prompt: 'Write a function that safely parses JSON and handles errors gracefully.',
        category: 'error-handling',
        expectedBehavior: 'Proper try-catch with meaningful error messages',
        timeout: 30000
      },
      {
        id: 'async-operation',
        prompt: 'Create an async function that fetches data from a mock API endpoint and processes it.',
        category: 'async',
        expectedBehavior: 'Use async/await with proper error handling',
        timeout: 45000
      }
    ]
  };
  
  const advancedTestSuite: TestSuite = {
    id: 'advanced',
    version: '1.0.0',
    name: 'Advanced Testing Suite',
    description: 'Complex scenarios for experienced configurations',
    tests: [
      {
        id: 'design-pattern',
        prompt: 'Implement a TypeScript class using the Observer pattern for event handling.',
        category: 'design-patterns',
        expectedBehavior: 'Proper implementation with interfaces and type safety',
        timeout: 60000
      },
      {
        id: 'performance-optimization',
        prompt: 'Optimize this slow function that processes large arrays. Find and fix performance bottlenecks.',
        category: 'optimization',
        expectedBehavior: 'Identify performance issues and provide optimized solution',
        timeout: 60000
      },
      {
        id: 'security-review',
        prompt: 'Review this authentication code for security vulnerabilities and suggest fixes.',
        category: 'security',
        expectedBehavior: 'Identify security issues and provide secure alternatives',
        timeout: 90000
      },
      {
        id: 'complex-refactor',
        prompt: 'Refactor this monolithic function into smaller, testable components while maintaining functionality.',
        category: 'refactoring',
        expectedBehavior: 'Break down complex code while preserving behavior',
        timeout: 120000
      }
    ]
  };
  
  await db.saveTestSuite(basicTestSuite);
  await db.saveTestSuite(advancedTestSuite);
}