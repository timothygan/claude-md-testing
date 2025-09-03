# CLAUDE.md Testing & Evaluation Application

A comprehensive testing framework for evaluating and optimizing your CLAUDE.md instruction files. This application allows you to test different CLAUDE.md configurations against standardized test suites and compare their performance across multiple metrics.

## Features

- **Isolated Testing Environment**: Each test runs in a fresh virtual file system
- **Comprehensive Data Capture**: Records full conversation history, tool calls, and performance metrics
- **Advanced Evaluation**: Scores performance across 9 different metrics (0-10 scale each)
- **Comparison Tools**: Side-by-side comparison of different CLAUDE.md configurations
- **CLI Interface**: Easy-to-use command-line tools for managing tests
- **Detailed Reporting**: Multiple output formats (table, JSON, markdown)

## Quick Start

### 1. Installation

```bash
# Clone and install dependencies
npm install

# Create your environment file
cp .env.example .env

# Add your Anthropic API key to .env
ANTHROPIC_API_KEY=your-api-key-here
```

### 2. Initialize

```bash
# Set up database and sample files
npm run claude-test init
```

### 3. Add Your CLAUDE.md File

```bash
# Add your CLAUDE.md file
npm run claude-test add --file ./path/to/your/claude.md --name "my-config" --description "My custom configuration"
```

### 4. Run Tests

```bash
# Run basic test suite
npm run claude-test run --claude-file "my-config" --suite "basic"

# View results
npm run claude-test results --latest
```

## CLI Commands

### `claude-test init`
Initialize the testing environment, create database, and generate sample files.

### `claude-test add`
Add a CLAUDE.md file to the testing system.

```bash
claude-test add --file ./claude.md --name "config-name" [--description "Description"]
```

### `claude-test run`
Run tests on a CLAUDE.md configuration.

```bash
claude-test run --claude-file "config-name" --suite "basic"
```

### `claude-test list`
List available files, test runs, or test suites.

```bash
claude-test list --type files     # List CLAUDE.md files
claude-test list --type runs      # List test runs  
claude-test list --type suites    # List test suites
```

### `claude-test results`
View detailed test results.

```bash
claude-test results --latest                    # Latest test run
claude-test results --run-id 42                # Specific run
claude-test results --latest --format json     # JSON output
claude-test results --latest --format markdown # Markdown output
```

### `claude-test compare`
Compare multiple CLAUDE.md configurations.

```bash
claude-test compare --files "config1" "config2" "config3"
```

## Evaluation Metrics

Each test is scored on a 0-10 scale across these metrics:

- **Correctness**: Does the output solve the problem correctly?
- **Speed**: Response time and execution efficiency
- **Token Efficiency**: Optimal use of input/output tokens
- **Documentation**: Quality of explanations and comments
- **Code Quality**: Best practices, readability, error handling
- **Security**: Security best practices and vulnerability avoidance
- **Instruction Adherence**: How well it follows CLAUDE.md rules
- **Consistency**: Similar outputs for similar prompts
- **Error Recovery**: Ability to handle and recover from errors

## Test Suites

### Basic Test Suite
- Simple function creation
- File read/write operations
- Error handling
- Async operations

### Advanced Test Suite
- Design pattern implementation
- Performance optimization
- Security review
- Complex refactoring

## Architecture

### Core Components

- **Virtual File System**: Sandboxed environment for safe testing
- **Anthropic API Client**: Direct integration with Claude API
- **Test Runner**: Orchestrates test execution with progress tracking
- **Evaluator Modules**: Pluggable scoring system for each metric
- **Database Storage**: SQLite for test results and history
- **CLI Interface**: User-friendly command-line tools

### Data Capture

The system captures comprehensive data for analysis:

- Full conversation history with tool calls
- Token usage (input, output, thinking)
- Response times and performance metrics
- File operations and command executions
- Error events and recovery attempts
- Virtual file system snapshots

## Extending the System

### Adding New Evaluators

Create a new evaluator by extending `BaseEvaluator`:

```typescript
import { BaseEvaluator } from './base-evaluator';

export class CustomEvaluator extends BaseEvaluator {
  readonly metricName = 'customMetric';
  readonly description = 'Custom evaluation logic';
  
  evaluate(test, result, conversation, metrics): number {
    // Your evaluation logic here
    return this.normalizeScore(score);
  }
}
```

### Adding New Test Suites

Test suites are defined in JSON/YAML format:

```typescript
const customSuite: TestSuite = {
  id: 'custom',
  version: '1.0.0',
  name: 'Custom Test Suite',
  tests: [
    {
      id: 'test-1',
      prompt: 'Your test prompt here',
      category: 'category-name',
      expectedBehavior: 'What you expect',
      timeout: 30000
    }
  ]
};
```

## Development

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Run built version
npm start
```

## Data Storage

All data is stored in SQLite (`claude-test.db`) with the following structure:

- `claude_files`: CLAUDE.md file versions and metadata
- `test_suites`: Test suite definitions  
- `test_runs`: Test execution records
- `test_results`: Individual test results with full conversation data

## API Integration

The system uses Anthropic's API directly for maximum control and data capture. Virtual tools simulate file operations and command execution for safety while maintaining realistic behavior.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

## Example Usage

```bash
# Initialize the system
npm run claude-test init

# Add your CLAUDE.md files
npm run claude-test add --file ./basic-claude.md --name "basic"
npm run claude-test add --file ./advanced-claude.md --name "advanced"

# Run tests on both
npm run claude-test run --claude-file "basic" --suite "basic"
npm run claude-test run --claude-file "advanced" --suite "basic"

# Compare the results
npm run claude-test compare --files "basic" "advanced"

# View detailed results
npm run claude-test results --latest --format table
```

This will help you optimize your CLAUDE.md instructions for better performance across all metrics!
