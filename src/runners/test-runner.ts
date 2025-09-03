import { ClaudeClient } from '../api/claude-client';
import { 
  TestSuite, 
  Test, 
  TestRun, 
  TestResult, 
  ClaudeFile,
  RawMetrics,
  MetricScores
} from '../types';
import { VirtualFileSystem } from '../utils/virtual-fs';
import { EvaluatorManager } from '../evaluators/evaluator-manager';

export interface TestRunnerConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export class TestRunner {
  private client: ClaudeClient;
  private config: TestRunnerConfig;
  private evaluatorManager: EvaluatorManager;

  constructor(config: TestRunnerConfig) {
    this.config = config;
    this.client = new ClaudeClient({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    });
    this.evaluatorManager = new EvaluatorManager();
  }

  async runTestSuite(
    claudeFile: ClaudeFile,
    testSuite: TestSuite,
    callbacks?: {
      onTestStart?: (test: Test) => void;
      onTestComplete?: (test: Test, result: TestResult) => void;
      onProgress?: (completed: number, total: number) => void;
    }
  ): Promise<{
    testRun: TestRun;
    results: TestResult[];
    summary: TestSummary;
  }> {
    const testRun: TestRun = {
      claudeFileId: claudeFile.id!,
      testSuiteVersion: testSuite.version,
      startedAt: new Date(),
      status: 'running'
    };

    const results: TestResult[] = [];
    let completed = 0;

    for (const test of testSuite.tests) {
      callbacks?.onTestStart?.(test);
      
      // Reset environment for each test
      this.client.reset();
      
      try {
        const result = await this.runSingleTest(
          claudeFile.content,
          test,
          testRun.id!
        );
        
        results.push(result);
        callbacks?.onTestComplete?.(test, result);
      } catch (error) {
        console.error(`Test ${test.id} failed:`, error);
        // Create a failed result
        const failedResult = this.createFailedResult(test, testRun.id!, error);
        results.push(failedResult);
        callbacks?.onTestComplete?.(test, failedResult);
      }
      
      completed++;
      callbacks?.onProgress?.(completed, testSuite.tests.length);
    }

    testRun.completedAt = new Date();
    testRun.status = 'completed';

    const summary = this.calculateSummary(results);

    return {
      testRun,
      results,
      summary
    };
  }

  private async runSingleTest(
    claudeMdContent: string,
    test: Test,
    testRunId: number
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    const executionResult = await this.client.executeWithClaudeFile(
      claudeMdContent,
      test.prompt,
      { timeout: test.timeout || this.config.timeout }
    );

    const virtualFS = this.client.getVirtualFS();
    const commandHistory = this.client.getCommandHistory();
    
    // Collect raw metrics
    const rawMetrics: RawMetrics = {
      allToolCalls: executionResult.conversation.messages
        .flatMap(m => m.toolCalls || []),
      fileOperations: virtualFS.getFileOperations(),
      commandsExecuted: commandHistory,
      errorsEncountered: this.extractErrors(executionResult.conversation),
      retryAttempts: this.countRetries(executionResult.conversation)
    };

    // Calculate scores using evaluator modules
    const scores = await this.evaluatorManager.evaluateAll(
      test,
      { 
        testRunId,
        testId: test.id,
        prompt: test.prompt,
        response: executionResult.response,
        tokensInput: executionResult.tokensUsed.input,
        tokensOutput: executionResult.tokensUsed.output,
        tokensThinking: executionResult.tokensUsed.thinking,
        responseTimeMs: executionResult.duration,
        scores: {} as MetricScores, // Temporary, will be replaced
        conversation: executionResult.conversation,
        metricsRaw: rawMetrics
      }
    );

    const result: TestResult = {
      testRunId,
      testId: test.id,
      prompt: test.prompt,
      response: executionResult.response,
      tokensInput: executionResult.tokensUsed.input,
      tokensOutput: executionResult.tokensUsed.output,
      tokensThinking: executionResult.tokensUsed.thinking,
      responseTimeMs: executionResult.duration,
      scores,
      conversation: executionResult.conversation,
      metricsRaw: rawMetrics
    };

    return result;
  }

  private calculateBasicScores(
    test: Test,
    execution: any,
    metrics: RawMetrics
  ): MetricScores {
    // Basic scoring logic - will be enhanced by evaluator modules
    const hasErrors = metrics.errorsEncountered.length > 0;
    const responseTime = execution.duration;
    const tokenRatio = execution.tokensUsed.output / execution.tokensUsed.input;
    
    return {
      correctness: hasErrors ? 5 : 8, // Placeholder
      speed: responseTime < 5000 ? 9 : responseTime < 10000 ? 7 : 5,
      tokenEfficiency: tokenRatio < 2 ? 9 : tokenRatio < 5 ? 7 : 5,
      documentation: 7, // Placeholder
      codeQuality: 7, // Placeholder
      security: hasErrors ? 5 : 8, // Placeholder
      instructionAdherence: 7, // Placeholder
      consistency: 7, // Placeholder
      errorRecovery: metrics.retryAttempts > 0 ? 6 : 8
    };
  }

  private extractErrors(conversation: any): any[] {
    const errors: any[] = [];
    
    conversation.messages.forEach((msg: any) => {
      if (msg.toolCalls) {
        msg.toolCalls.forEach((call: any) => {
          if (call.error) {
            errors.push({
              type: 'tool_error',
              message: call.error,
              timestamp: msg.timestamp,
              recovered: false
            });
          }
        });
      }
    });
    
    return errors;
  }

  private countRetries(conversation: any): number {
    // Count retry attempts based on similar consecutive tool calls
    let retries = 0;
    let lastToolCall: any = null;
    
    conversation.messages.forEach((msg: any) => {
      if (msg.toolCalls) {
        msg.toolCalls.forEach((call: any) => {
          if (lastToolCall && 
              lastToolCall.toolName === call.toolName &&
              JSON.stringify(lastToolCall.parameters) === JSON.stringify(call.parameters)) {
            retries++;
          }
          lastToolCall = call;
        });
      }
    });
    
    return retries;
  }

  private createFailedResult(test: Test, testRunId: number, error: any): TestResult {
    return {
      testRunId,
      testId: test.id,
      prompt: test.prompt,
      response: `Test failed: ${error.message || error}`,
      tokensInput: 0,
      tokensOutput: 0,
      responseTimeMs: 0,
      scores: {
        correctness: 0,
        speed: 0,
        tokenEfficiency: 0,
        documentation: 0,
        codeQuality: 0,
        security: 0,
        instructionAdherence: 0,
        consistency: 0,
        errorRecovery: 0
      },
      conversation: {
        messages: [],
        totalDurationMs: 0,
        modelConfig: {
          model: this.config.model || '',
          temperature: this.config.temperature || 0,
          maxTokens: this.config.maxTokens || 0
        }
      },
      metricsRaw: {
        allToolCalls: [],
        fileOperations: [],
        commandsExecuted: [],
        errorsEncountered: [{
          type: 'test_failure',
          message: error.message || error,
          timestamp: Date.now(),
          recovered: false
        }],
        retryAttempts: 0
      }
    };
  }

  private calculateSummary(results: TestResult[]): TestSummary {
    const totalTests = results.length;
    const failedTests = results.filter(r => r.scores.correctness === 0).length;
    const passedTests = totalTests - failedTests;
    
    const avgScores: MetricScores = {
      correctness: 0,
      speed: 0,
      tokenEfficiency: 0,
      documentation: 0,
      codeQuality: 0,
      security: 0,
      instructionAdherence: 0,
      consistency: 0,
      errorRecovery: 0
    };
    
    if (totalTests > 0) {
      results.forEach(result => {
        Object.keys(avgScores).forEach(key => {
          (avgScores as any)[key] += (result.scores as any)[key];
        });
      });
      
      Object.keys(avgScores).forEach(key => {
        (avgScores as any)[key] /= totalTests;
      });
    }
    
    const totalTokens = results.reduce((sum, r) => 
      sum + r.tokensInput + r.tokensOutput + (r.tokensThinking || 0), 0
    );
    
    const totalTime = results.reduce((sum, r) => sum + r.responseTimeMs, 0);
    
    return {
      totalTests,
      passedTests,
      failedTests,
      averageScores: avgScores,
      totalTokensUsed: totalTokens,
      totalTimeMs: totalTime,
      successRate: totalTests > 0 ? passedTests / totalTests : 0
    };
  }
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageScores: MetricScores;
  totalTokensUsed: number;
  totalTimeMs: number;
  successRate: number;
}