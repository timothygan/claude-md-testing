import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import { 
  ClaudeFile, 
  TestRun, 
  TestResult, 
  TestSuite,
  ConversationHistory,
  RawMetrics,
  MetricScores
} from '../types';

export class TestDatabase {
  private db: Database.Database;

  constructor(dbPath: string = './claude-test.db') {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables() {
    // Claude files table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS claude_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        hash TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Test suites table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_suites (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        tests TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Test runs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claude_file_id INTEGER NOT NULL,
        test_suite_version TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        status TEXT NOT NULL,
        FOREIGN KEY (claude_file_id) REFERENCES claude_files(id)
      )
    `);

    // Test results table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_run_id INTEGER NOT NULL,
        test_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT NOT NULL,
        tokens_input INTEGER NOT NULL,
        tokens_output INTEGER NOT NULL,
        tokens_thinking INTEGER,
        response_time_ms INTEGER NOT NULL,
        scores TEXT NOT NULL,
        conversation TEXT NOT NULL,
        metrics_raw TEXT NOT NULL,
        FOREIGN KEY (test_run_id) REFERENCES test_runs(id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_test_runs_claude_file 
      ON test_runs(claude_file_id);
      
      CREATE INDEX IF NOT EXISTS idx_test_results_run 
      ON test_results(test_run_id);
      
      CREATE INDEX IF NOT EXISTS idx_claude_files_hash 
      ON claude_files(hash);
    `);
  }

  // Claude file operations
  async saveClaudeFile(file: Omit<ClaudeFile, 'id' | 'hash' | 'createdAt'>): Promise<ClaudeFile> {
    const hash = crypto.createHash('sha256').update(file.content).digest('hex');
    const createdAt = new Date();

    // Check if file with same hash already exists
    const existing = this.db.prepare(
      'SELECT * FROM claude_files WHERE hash = ?'
    ).get(hash) as any;

    if (existing) {
      return this.mapClaudeFile(existing);
    }

    const result = this.db.prepare(`
      INSERT INTO claude_files (name, content, hash, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      file.name,
      file.content,
      hash,
      file.description || null,
      createdAt.getTime()
    );

    return {
      id: result.lastInsertRowid as number,
      name: file.name,
      content: file.content,
      hash,
      description: file.description,
      createdAt
    };
  }

  async getClaudeFile(id: number): Promise<ClaudeFile | null> {
    const row = this.db.prepare(
      'SELECT * FROM claude_files WHERE id = ?'
    ).get(id) as any;

    return row ? this.mapClaudeFile(row) : null;
  }

  async getClaudeFileByName(name: string): Promise<ClaudeFile | null> {
    const row = this.db.prepare(
      'SELECT * FROM claude_files WHERE name = ? ORDER BY created_at DESC LIMIT 1'
    ).get(name) as any;

    return row ? this.mapClaudeFile(row) : null;
  }

  async listClaudeFiles(): Promise<ClaudeFile[]> {
    const rows = this.db.prepare(
      'SELECT * FROM claude_files ORDER BY created_at DESC'
    ).all() as any[];

    return rows.map(row => this.mapClaudeFile(row));
  }

  // Test suite operations
  async saveTestSuite(suite: TestSuite): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO test_suites (id, version, name, description, tests, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      suite.id,
      suite.version,
      suite.name,
      suite.description || null,
      JSON.stringify(suite.tests),
      Date.now()
    );
  }

  async getTestSuite(id: string): Promise<TestSuite | null> {
    const row = this.db.prepare(
      'SELECT * FROM test_suites WHERE id = ?'
    ).get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      version: row.version,
      name: row.name,
      description: row.description,
      tests: JSON.parse(row.tests)
    };
  }

  // Test run operations
  async createTestRun(claudeFileId: number, testSuiteVersion: string): Promise<TestRun> {
    const result = this.db.prepare(`
      INSERT INTO test_runs (claude_file_id, test_suite_version, started_at, status)
      VALUES (?, ?, ?, ?)
    `).run(
      claudeFileId,
      testSuiteVersion,
      Date.now(),
      'pending'
    );

    return {
      id: result.lastInsertRowid as number,
      claudeFileId,
      testSuiteVersion,
      startedAt: new Date(),
      status: 'pending'
    };
  }

  async updateTestRun(id: number, updates: Partial<TestRun>): Promise<void> {
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.completedAt) {
      sets.push('completed_at = ?');
      values.push(updates.completedAt.getTime());
    }

    if (updates.status) {
      sets.push('status = ?');
      values.push(updates.status);
    }

    if (sets.length === 0) return;

    values.push(id);
    this.db.prepare(
      `UPDATE test_runs SET ${sets.join(', ')} WHERE id = ?`
    ).run(...values);
  }

  // Test result operations
  async saveTestResult(result: TestResult): Promise<void> {
    this.db.prepare(`
      INSERT INTO test_results (
        test_run_id, test_id, prompt, response,
        tokens_input, tokens_output, tokens_thinking,
        response_time_ms, scores, conversation, metrics_raw
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.testRunId,
      result.testId,
      result.prompt,
      result.response,
      result.tokensInput,
      result.tokensOutput,
      result.tokensThinking || null,
      result.responseTimeMs,
      JSON.stringify(result.scores),
      JSON.stringify(result.conversation),
      JSON.stringify(result.metricsRaw)
    );
  }

  async getTestResults(testRunId: number): Promise<TestResult[]> {
    const rows = this.db.prepare(
      'SELECT * FROM test_results WHERE test_run_id = ?'
    ).all(testRunId) as any[];

    return rows.map(row => this.mapTestResult(row));
  }

  async getTestRun(id: number): Promise<TestRun | null> {
    const row = this.db.prepare(
      'SELECT * FROM test_runs WHERE id = ?'
    ).get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      claudeFileId: row.claude_file_id,
      testSuiteVersion: row.test_suite_version,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      status: row.status
    };
  }

  async listTestRuns(claudeFileId?: number): Promise<TestRun[]> {
    const query = claudeFileId
      ? 'SELECT * FROM test_runs WHERE claude_file_id = ? ORDER BY started_at DESC'
      : 'SELECT * FROM test_runs ORDER BY started_at DESC';
    
    const rows = claudeFileId
      ? this.db.prepare(query).all(claudeFileId) as any[]
      : this.db.prepare(query).all() as any[];

    return rows.map(row => ({
      id: row.id,
      claudeFileId: row.claude_file_id,
      testSuiteVersion: row.test_suite_version,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      status: row.status
    }));
  }

  // Comparison queries
  async compareClaudeFiles(fileIds: number[]): Promise<any> {
    const placeholders = fileIds.map(() => '?').join(',');
    const query = `
      SELECT 
        cf.id as claude_file_id,
        cf.name as claude_file_name,
        tr.id as test_run_id,
        AVG(CAST(json_extract(tr_res.scores, '$.correctness') AS REAL)) as avg_correctness,
        AVG(CAST(json_extract(tr_res.scores, '$.speed') AS REAL)) as avg_speed,
        AVG(CAST(json_extract(tr_res.scores, '$.tokenEfficiency') AS REAL)) as avg_token_efficiency,
        AVG(CAST(json_extract(tr_res.scores, '$.codeQuality') AS REAL)) as avg_code_quality,
        AVG(tr_res.tokens_input + tr_res.tokens_output) as avg_tokens_used,
        AVG(tr_res.response_time_ms) as avg_response_time
      FROM claude_files cf
      JOIN test_runs tr ON cf.id = tr.claude_file_id
      JOIN test_results tr_res ON tr.id = tr_res.test_run_id
      WHERE cf.id IN (${placeholders})
      GROUP BY cf.id, tr.id
      ORDER BY cf.id, tr.started_at DESC
    `;

    return this.db.prepare(query).all(...fileIds);
  }

  // Helper methods
  private mapClaudeFile(row: any): ClaudeFile {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      hash: row.hash,
      description: row.description,
      createdAt: new Date(row.created_at)
    };
  }

  private mapTestResult(row: any): TestResult {
    return {
      id: row.id,
      testRunId: row.test_run_id,
      testId: row.test_id,
      prompt: row.prompt,
      response: row.response,
      tokensInput: row.tokens_input,
      tokensOutput: row.tokens_output,
      tokensThinking: row.tokens_thinking,
      responseTimeMs: row.response_time_ms,
      scores: JSON.parse(row.scores),
      conversation: JSON.parse(row.conversation),
      metricsRaw: JSON.parse(row.metrics_raw)
    };
  }

  close() {
    this.db.close();
  }
}