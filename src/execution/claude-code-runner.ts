import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Test, TestResult, ConversationHistory, RawMetrics, MetricScores } from '../types';

export interface ClaudeCodeRunnerConfig {
  workspaceDir?: string;
  timeout?: number;
  useSkipPermissions?: boolean;
}

export class ClaudeCodeRunner {
  private config: Required<ClaudeCodeRunnerConfig>;
  
  constructor(config: ClaudeCodeRunnerConfig = {}) {
    this.config = {
      workspaceDir: config.workspaceDir || './test-workspaces',
      timeout: config.timeout || 120000, // 2 minutes
      useSkipPermissions: config.useSkipPermissions ?? true
    };
  }

  async executeTest(
    claudeMdContent: string,
    test: Test,
    testRunId: number
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    // Create isolated workspace
    const workspaceId = `test-${testRunId}-${test.id}-${Date.now()}`;
    const workspacePath = path.join(this.config.workspaceDir, workspaceId);
    
    try {
      await fs.mkdir(workspacePath, { recursive: true });
      
      // Write CLAUDE.md file to workspace
      const claudeMdPath = path.join(workspacePath, 'CLAUDE.md');
      await fs.writeFile(claudeMdPath, claudeMdContent);
      
      // Execute Claude Code
      const executionResult = await this.runClaudeCode(
        workspacePath,
        test.prompt,
        test.timeout || this.config.timeout
      );
      
      // Collect metrics
      const rawMetrics = await this.collectMetrics(workspacePath, executionResult);
      
      // Calculate basic scores (will be enhanced by evaluators)
      const scores: MetricScores = {
        correctness: 7, // Will be calculated by evaluators
        speed: executionResult.duration < 30000 ? 9 : 6,
        tokenEfficiency: 7, // Estimated
        documentation: 7,
        codeQuality: 7,
        security: 7,
        instructionAdherence: 7,
        consistency: 7,
        errorRecovery: executionResult.exitCode === 0 ? 8 : 4
      };
      
      const result: TestResult = {
        testRunId: testRunId, // Make sure this is explicitly set
        testId: test.id,
        prompt: test.prompt,
        response: executionResult.output,
        tokensInput: this.estimateTokens(test.prompt + claudeMdContent),
        tokensOutput: this.estimateTokens(executionResult.output),
        responseTimeMs: executionResult.duration,
        scores,
        conversation: {
          messages: [{
            role: 'user',
            content: test.prompt,
            timestamp: startTime,
            tokens: { input: this.estimateTokens(test.prompt), output: 0 }
          }, {
            role: 'assistant', 
            content: executionResult.output,
            timestamp: startTime + executionResult.duration,
            tokens: { input: 0, output: this.estimateTokens(executionResult.output) }
          }],
          totalDurationMs: executionResult.duration,
          modelConfig: {
            model: 'claude-code',
            temperature: 0,
            maxTokens: 0
          }
        },
        metricsRaw: rawMetrics
      };
      
      return result;
      
    } finally {
      // Cleanup workspace
      try {
        await fs.rm(workspacePath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup workspace ${workspacePath}:`, error);
      }
    }
  }

  private async runClaudeCode(
    workspacePath: string,
    prompt: string,
    timeout: number
  ): Promise<{
    output: string;
    exitCode: number;
    duration: number;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // Prepare Claude Code command
      const args = [
        '--working-directory', workspacePath
      ];
      
      if (this.config.useSkipPermissions) {
        args.push('--dangerously-skip-permissions');
      }
      
      // Add prompt as argument
      args.push(prompt);
      
      const claudeProcess = spawn('claude', args, {
        cwd: workspacePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      claudeProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      claudeProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      const timeoutId = setTimeout(() => {
        claudeProcess.kill('SIGTERM');
        resolve({
          output: output + '\n[TIMEOUT]',
          exitCode: 124, // timeout exit code
          duration: Date.now() - startTime,
          error: 'Process timed out'
        });
      }, timeout);
      
      claudeProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          output: output || errorOutput,
          exitCode: code || 0,
          duration: Date.now() - startTime,
          error: errorOutput || undefined
        });
      });
      
      claudeProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          output: `Error executing claude: ${error.message}`,
          exitCode: 1,
          duration: Date.now() - startTime,
          error: error.message
        });
      });
    });
  }

  private async collectMetrics(
    workspacePath: string,
    executionResult: any
  ): Promise<RawMetrics> {
    const fileOperations: any[] = [];
    const commandsExecuted: any[] = [];
    const errorsEncountered: any[] = [];
    
    try {
      // Check what files were created/modified
      const files = await this.listFilesRecursively(workspacePath);
      files.forEach(file => {
        if (!file.endsWith('CLAUDE.md')) {
          fileOperations.push({
            type: 'write',
            path: file,
            timestamp: Date.now(),
            success: true
          });
        }
      });
    } catch (error) {
      // Ignore errors in file collection
    }
    
    // Extract errors from output
    if (executionResult.error || executionResult.exitCode !== 0) {
      errorsEncountered.push({
        type: 'execution_error',
        message: executionResult.error || 'Process exited with non-zero code',
        timestamp: Date.now(),
        recovered: false
      });
    }
    
    return {
      allToolCalls: [], // Claude Code doesn't expose this
      fileOperations,
      commandsExecuted,
      errorsEncountered,
      retryAttempts: 0
    };
  }

  private async listFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await this.listFilesRecursively(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return files;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}