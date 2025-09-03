import { BaseEvaluator } from './base-evaluator';
import { Test, TestResult, ConversationHistory, RawMetrics } from '../types';

export class CodeQualityEvaluator extends BaseEvaluator {
  readonly metricName = 'codeQuality';
  readonly description = 'Evaluates code structure, readability, and best practices';

  evaluate(
    test: Test,
    result: TestResult,
    conversation: ConversationHistory,
    metrics: RawMetrics
  ): number {
    let score = 8; // Start with a good baseline
    
    // Check file operations for good practices
    const fileOps = metrics.fileOperations;
    
    // Check if files are read before being edited
    const editsWithoutRead = this.countEditsWithoutRead(fileOps);
    if (editsWithoutRead > 0) {
      score -= editsWithoutRead * 1.5;
    }
    
    // Check for error handling
    const hasErrorHandling = this.checkErrorHandling(conversation);
    if (!hasErrorHandling && metrics.errorsEncountered.length > 0) {
      score -= 2;
    }
    
    // Check for file organization (creating appropriate structure)
    const hasGoodStructure = this.checkFileStructure(fileOps);
    if (hasGoodStructure) {
      score += 1;
    }
    
    // Check for consistent operations (not jumping around randomly)
    const consistency = this.checkOperationConsistency(metrics);
    score += consistency * 2 - 1; // -1 to 1 adjustment
    
    return this.normalizeScore(score);
  }
  
  private countEditsWithoutRead(fileOps: any[]): number {
    const readFiles = new Set<string>();
    let editsWithoutRead = 0;
    
    fileOps.forEach(op => {
      if (op.type === 'read') {
        readFiles.add(op.path);
      } else if (op.type === 'edit' || op.type === 'write') {
        if (!readFiles.has(op.path) && op.type === 'edit') {
          editsWithoutRead++;
        }
      }
    });
    
    return editsWithoutRead;
  }
  
  private checkErrorHandling(conversation: ConversationHistory): boolean {
    // Check if the response mentions error handling or try-catch
    const errorHandlingKeywords = ['try', 'catch', 'error', 'exception', 'handle', 'validate'];
    
    return conversation.messages.some(msg => 
      msg.role === 'assistant' && 
      errorHandlingKeywords.some(keyword => 
        msg.content.toLowerCase().includes(keyword)
      )
    );
  }
  
  private checkFileStructure(fileOps: any[]): boolean {
    // Check if files are organized in directories
    const paths = fileOps.map(op => op.path);
    const hasDirectories = paths.some(path => path.includes('/') && path.split('/').length > 2);
    return hasDirectories;
  }
  
  private checkOperationConsistency(metrics: RawMetrics): number {
    // Check if operations follow a logical sequence
    const ops = [...metrics.fileOperations].sort((a, b) => a.timestamp - b.timestamp);
    
    if (ops.length < 2) return 1;
    
    let consistentSequences = 0;
    let totalSequences = 0;
    
    for (let i = 1; i < ops.length; i++) {
      totalSequences++;
      // Check if operations on same file are close together
      if (ops[i].path === ops[i-1].path || 
          Math.abs(ops[i].timestamp - ops[i-1].timestamp) < 5000) {
        consistentSequences++;
      }
    }
    
    return totalSequences > 0 ? consistentSequences / totalSequences : 1;
  }
}