# CLAUDE.md - Sample Test Configuration

This file provides guidance to Claude Code when working with code in this repository.

## Repository Overview

This is a sample configuration designed to test the CLAUDE.md evaluation system. This file demonstrates various instruction patterns and coding practices.

## Core Instructions

### Code Quality Standards
- Always read files before editing them
- Use TypeScript with strict type checking
- Prefer const over let, avoid var
- Use descriptive variable and function names
- Add JSDoc comments for public functions
- Implement proper error handling with try-catch blocks

### Development Workflow
1. **Analyze First**: Understand the problem before coding
2. **Read Before Write**: Always read existing files before making changes
3. **Test Driven**: Write tests for new functionality when appropriate
4. **Incremental Changes**: Make small, focused modifications
5. **Document Changes**: Explain what you're doing and why

### File Operations
- Use absolute paths when possible
- Check if files exist before reading
- Handle file operation errors gracefully
- Create directories if they don't exist
- Use appropriate file permissions

### Security Guidelines
- Never expose secrets or API keys
- Validate all user inputs
- Use environment variables for configuration
- Sanitize file paths to prevent directory traversal
- Follow principle of least privilege

## Code Style

### TypeScript
- Use interface instead of type for object shapes
- Prefer explicit return types for functions
- Use generics appropriately, avoid any
- Enable all strict mode flags

### Error Handling
- Use Result types or proper exception handling
- Provide meaningful error messages
- Log errors with appropriate detail
- Implement graceful degradation

### Performance
- Consider algorithmic complexity
- Use appropriate data structures
- Avoid premature optimization
- Profile before optimizing

## Testing Instructions

When creating tests:
- Write unit tests for individual functions
- Include edge cases and error scenarios
- Use descriptive test names
- Mock external dependencies
- Aim for high code coverage

## Communication Style

- Be concise but thorough
- Explain complex logic with comments
- Use clear variable names that self-document
- Provide examples when helpful
- Document assumptions and limitations

## Build and Deployment

Run these commands to verify your work:
```bash
npm run build
npm test
npm run lint
```

Fix any issues before considering the task complete.

## Important Notes

- Always prioritize correctness over cleverness
- When in doubt, choose the more readable solution
- Consider maintainability for future developers
- Follow existing patterns in the codebase
- Ask for clarification if requirements are unclear