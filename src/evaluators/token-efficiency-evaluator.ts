import { BaseEvaluator } from './base-evaluator';
import { Test, TestResult, ConversationHistory, RawMetrics } from '../types';

export class TokenEfficiencyEvaluator extends BaseEvaluator {
  readonly metricName = 'tokenEfficiency';
  readonly description = 'Evaluates token usage optimization';

  evaluate(
    test: Test,
    result: TestResult,
    conversation: ConversationHistory,
    metrics: RawMetrics
  ): number {
    const inputTokens = result.tokensInput;
    const outputTokens = result.tokensOutput;
    const thinkingTokens = result.tokensThinking || 0;
    const totalTokens = inputTokens + outputTokens + thinkingTokens;
    
    // Calculate output/input ratio
    const outputRatio = outputTokens / inputTokens;
    
    // Ideal ratio is between 1 and 3 (not too verbose, not too terse)
    let ratioScore = 10;
    if (outputRatio < 0.5) {
      ratioScore = 6; // Too terse
    } else if (outputRatio > 5) {
      ratioScore = 5 - Math.min(3, Math.floor((outputRatio - 5) / 2));
    } else if (outputRatio > 3) {
      ratioScore = 8;
    }
    
    // Penalize excessive total token usage
    let totalScore = 10;
    if (totalTokens > 10000) {
      totalScore = 5;
    } else if (totalTokens > 5000) {
      totalScore = 7;
    } else if (totalTokens > 3000) {
      totalScore = 9;
    }
    
    // Check for wasted tokens (multiple similar tool calls)
    let wasteScore = 10;
    const duplicateTools = this.countDuplicateToolCalls(conversation);
    if (duplicateTools > 0) {
      wasteScore -= duplicateTools * 2;
    }
    
    // Average the three scores
    const finalScore = (ratioScore + totalScore + wasteScore) / 3;
    
    return this.normalizeScore(finalScore);
  }
  
  private countDuplicateToolCalls(conversation: ConversationHistory): number {
    const toolCallSignatures = new Map<string, number>();
    let duplicates = 0;
    
    conversation.messages.forEach(message => {
      message.toolCalls?.forEach(call => {
        const signature = `${call.toolName}:${JSON.stringify(call.parameters)}`;
        const count = (toolCallSignatures.get(signature) || 0) + 1;
        toolCallSignatures.set(signature, count);
        
        if (count > 1) {
          duplicates++;
        }
      });
    });
    
    return duplicates;
  }
}