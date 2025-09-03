import { BaseEvaluator } from './base-evaluator';
import { Test, TestResult, ConversationHistory, RawMetrics } from '../types';

export class CorrectnessEvaluator extends BaseEvaluator {
  readonly metricName = 'correctness';
  readonly description = 'Evaluates if the output correctly solves the problem';

  evaluate(
    test: Test,
    result: TestResult,
    conversation: ConversationHistory,
    metrics: RawMetrics
  ): number {
    let score = 10;
    
    // Check for errors
    if (metrics.errorsEncountered.length > 0) {
      const unrecoveredErrors = metrics.errorsEncountered.filter(e => !e.recovered);
      score -= unrecoveredErrors.length * 2;
      score -= (metrics.errorsEncountered.length - unrecoveredErrors.length) * 0.5;
    }
    
    // Check for retry attempts
    if (metrics.retryAttempts > 0) {
      score -= metrics.retryAttempts * 0.5;
    }
    
    // Check if response is empty or error message
    if (!result.response || result.response.includes('Test failed:')) {
      score = 0;
    }
    
    // Check for expected behavior if defined
    if (test.expectedBehavior) {
      // Simple keyword matching for now
      const keywords = this.extractKeywords(test.expectedBehavior);
      const responseKeywords = this.extractKeywords(result.response);
      const matchRate = this.calculateKeywordMatch(keywords, responseKeywords);
      score = Math.min(score, matchRate * 10);
    }
    
    return this.normalizeScore(score);
  }
  
  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3);
  }
  
  private calculateKeywordMatch(expected: string[], actual: string[]): number {
    if (expected.length === 0) return 1;
    const matches = expected.filter(keyword => actual.includes(keyword));
    return matches.length / expected.length;
  }
}