import { BaseEvaluator } from './base-evaluator';
import { CorrectnessEvaluator } from './correctness-evaluator';
import { SpeedEvaluator } from './speed-evaluator';
import { TokenEfficiencyEvaluator } from './token-efficiency-evaluator';
import { CodeQualityEvaluator } from './code-quality-evaluator';
import { Test, TestResult, MetricScores, ConversationHistory, RawMetrics } from '../types';

export class EvaluatorManager {
  private evaluators: Map<string, BaseEvaluator> = new Map();
  
  constructor() {
    this.registerDefaultEvaluators();
  }
  
  private registerDefaultEvaluators() {
    this.registerEvaluator(new CorrectnessEvaluator());
    this.registerEvaluator(new SpeedEvaluator());
    this.registerEvaluator(new TokenEfficiencyEvaluator());
    this.registerEvaluator(new CodeQualityEvaluator());
    
    // Add placeholder evaluators for remaining metrics
    this.registerEvaluator(new PlaceholderEvaluator('documentation', 'Quality of explanations and comments'));
    this.registerEvaluator(new PlaceholderEvaluator('security', 'Security best practices'));
    this.registerEvaluator(new PlaceholderEvaluator('instructionAdherence', 'Following CLAUDE.md instructions'));
    this.registerEvaluator(new PlaceholderEvaluator('consistency', 'Consistent behavior across similar prompts'));
    this.registerEvaluator(new PlaceholderEvaluator('errorRecovery', 'Ability to handle and recover from errors'));
  }
  
  registerEvaluator(evaluator: BaseEvaluator) {
    this.evaluators.set(evaluator.metricName, evaluator);
  }
  
  async evaluateAll(
    test: Test,
    result: TestResult
  ): Promise<MetricScores> {
    const scores: any = {};
    
    for (const [metricName, evaluator] of this.evaluators) {
      try {
        scores[metricName] = evaluator.evaluate(
          test,
          result,
          result.conversation,
          result.metricsRaw
        );
      } catch (error) {
        console.error(`Error evaluating ${metricName}:`, error);
        scores[metricName] = 5; // Default middle score on error
      }
    }
    
    return scores as MetricScores;
  }
  
  getEvaluatorDescriptions(): Record<string, string> {
    const descriptions: Record<string, string> = {};
    
    for (const [metricName, evaluator] of this.evaluators) {
      descriptions[metricName] = evaluator.description;
    }
    
    return descriptions;
  }
}

// Placeholder evaluator for metrics not yet fully implemented
class PlaceholderEvaluator extends BaseEvaluator {
  constructor(
    public readonly metricName: string,
    public readonly description: string
  ) {
    super();
  }
  
  evaluate(
    test: Test,
    result: TestResult,
    conversation: ConversationHistory,
    metrics: RawMetrics
  ): number {
    // Basic heuristic scoring
    let score = 7; // Start with decent baseline
    
    // Adjust based on errors
    if (metrics.errorsEncountered.length > 0) {
      score -= 1;
    }
    
    // Adjust based on response length (as proxy for completeness)
    if (result.response.length < 50) {
      score -= 2;
    } else if (result.response.length > 500) {
      score += 1;
    }
    
    return this.normalizeScore(score);
  }
}