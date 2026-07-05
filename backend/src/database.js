import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'sat_prep.db');

let db;

export function getDb() {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      section TEXT NOT NULL,
      rw_m1_correct INTEGER,
      rw_m1_total INTEGER,
      rw_m2_correct INTEGER,
      rw_m2_total INTEGER,
      math_m1_correct INTEGER,
      math_m1_total INTEGER,
      math_m2_correct INTEGER,
      math_m2_total INTEGER,
      rw_raw_score INTEGER,
      math_raw_score INTEGER,
      rw_scaled_score INTEGER,
      math_scaled_score INTEGER,
      total_scaled_score INTEGER,
      time_taken_seconds INTEGER,
      status TEXT DEFAULT 'in_progress',
      adaptive_harder_rw INTEGER DEFAULT 0,
      adaptive_harder_math INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS test_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      question_index INTEGER NOT NULL,
      question_data TEXT NOT NULL,
      user_answer TEXT,
      is_correct INTEGER,
      time_spent_seconds INTEGER,
      FOREIGN KEY (attempt_id) REFERENCES test_attempts(id)
    );
  `);
}
