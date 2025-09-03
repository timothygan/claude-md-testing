import { BaseEvaluator } from './base-evaluator';
import { Test, TestResult, ConversationHistory, RawMetrics } from '../types';

export class SpeedEvaluator extends BaseEvaluator {
  readonly metricName = 'speed';
  readonly description = 'Evaluates response time and execution efficiency';

  private readonly benchmarks = {
    excellent: 2000,  // < 2 seconds
    good: 5000,       // < 5 seconds
    acceptable: 10000, // < 10 seconds
    slow: 20000       // < 20 seconds
  };

  evaluate(
    test: Test,
    result: TestResult,
    conversation: ConversationHistory,
    metrics: RawMetrics
  ): number {
    const responseTime = result.responseTimeMs;
    
    if (responseTime <= this.benchmarks.excellent) return 10;
    if (responseTime <= this.benchmarks.good) return 8;
    if (responseTime <= this.benchmarks.acceptable) return 6;
    if (responseTime <= this.benchmarks.slow) return 4;
    
    // For very slow responses, calculate score based on how much over 20s
    const overSlowBy = responseTime - this.benchmarks.slow;
    const penalty = Math.floor(overSlowBy / 10000); // -1 point per 10 seconds over
    
    return this.normalizeScore(3 - penalty);
  }
}