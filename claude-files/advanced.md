# CLAUDE.md - Advanced Configuration

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
