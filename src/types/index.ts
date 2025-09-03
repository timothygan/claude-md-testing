export interface ClaudeFile {
  id?: number;
  name: string;
  content: string;
  hash: string;
  createdAt: Date;
  description?: string;
}

export interface TestSuite {
  id: string;
  version: string;
  name: string;
  description?: string;
  tests: Test[];
}

export interface Test {
  id: string;
  prompt: string;
  category: string;
  expectedBehavior?: string;
  evaluationCriteria?: Record<string, string>;
  timeout?: number;
}

export interface TestRun {
  id?: number;
  claudeFileId: number;
  testSuiteVersion: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface TestResult {
  id?: number;
  testRunId: number;
  testId: string;
  prompt: string;
  response: string;
  tokensInput: number;
  tokensOutput: number;
  tokensThinking?: number;
  responseTimeMs: number;
  scores: MetricScores;
  conversation: ConversationHistory;
  metricsRaw: RawMetrics;
}

export interface MetricScores {
  correctness: number;        // 0-10
  speed: number;              // 0-10
  tokenEfficiency: number;    // 0-10
  documentation: number;      // 0-10
  codeQuality: number;       // 0-10
  security: number;          // 0-10
  instructionAdherence: number; // 0-10
  consistency: number;       // 0-10
  errorRecovery: number;    // 0-10
}

export interface ConversationHistory {
  messages: Message[];
  totalDurationMs: number;
  modelConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  timestamp: number;
  tokens?: {
    input: number;
    output: number;
    thinking?: number;
  };
}

export interface ToolCall {
  toolName: string;
  parameters: any;
  result: any;
  executionTimeMs: number;
  error?: string;
}

export interface RawMetrics {
  allToolCalls: ToolCall[];
  fileOperations: FileOperation[];
  commandsExecuted: CommandExecution[];
  errorsEncountered: ErrorEvent[];
  retryAttempts: number;
}

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'edit';
  path: string;
  content?: string;
  timestamp: number;
  success: boolean;
}

export interface CommandExecution {
  command: string;
  output: string;
  exitCode: number;
  timestamp: number;
  durationMs: number;
}

export interface ErrorEvent {
  type: string;
  message: string;
  stack?: string;
  timestamp: number;
  recovered: boolean;
}

export interface VirtualFile {
  path: string;
  content: string;
  createdAt: number;
  modifiedAt: number;
  permissions: string;
}