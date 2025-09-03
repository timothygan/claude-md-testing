import { TestDatabase } from './database';
import * as path from 'path';
import * as fs from 'fs';

const dbPath = process.env.DATABASE_PATH || './claude-test.db';

console.log('Initializing database at:', path.resolve(dbPath));

const db = new TestDatabase(dbPath);

console.log('Database initialized successfully!');
console.log('Tables created:');
console.log('  - claude_files');
console.log('  - test_suites');
console.log('  - test_runs');
console.log('  - test_results');

db.close();

console.log('\nDatabase setup complete!');