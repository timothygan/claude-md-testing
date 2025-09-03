import { Test, TestResult, ConversationHistory, RawMetrics } from '../types';

export abstract class BaseEvaluator {
  abstract readonly metricName: string;
  abstract readonly description: string;
  
  abstract evaluate(
    test: Test,
    result: TestResult,
    conversation: ConversationHistory,
    metrics: RawMetrics
  ): number;
  
  protected normalizeScore(value: number, min: number = 0, max: number = 10): number {
    return Math.min(max, Math.max(min, value));
  }
  
  protected calculatePercentageScore(achieved: number, total: number): number {
    if (total === 0) return 10;
    const percentage = (achieved / total) * 100;
    return this.normalizeScore(percentage / 10);
  }
}