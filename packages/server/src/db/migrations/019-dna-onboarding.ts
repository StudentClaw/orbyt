import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 19

export function run(db: RuntimeSqliteDatabase): void {
  db.run("DROP TABLE IF EXISTS onboarding_state")
  db.run(`
    CREATE TABLE onboarding_state (
      step_name TEXT PRIMARY KEY
        CHECK(step_name IN (
          'dna-discovery',
          'active-hours',
          'busy-grid',
          'ai-connect',
          'canvas-sync',
          'launch'
        )),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'completed', 'skipped')),
      completed_at TEXT
    )
  `)

  db.run("UPDATE onboarding_meta SET value = 'in_progress' WHERE key = 'overall_status'")

  db.run(`
    CREATE TABLE IF NOT EXISTS student_dna (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      archetype_id TEXT NOT NULL,
      trait TEXT NOT NULL,
      tagline TEXT NOT NULL,
      icon TEXT NOT NULL,
      hue REAL NOT NULL,
      accent_hue REAL NOT NULL,
      is_rare INTEGER NOT NULL DEFAULT 0,
      rarity TEXT NOT NULL DEFAULT 'Common',
      stats TEXT NOT NULL DEFAULT '{}',
      peak TEXT NOT NULL,
      style TEXT NOT NULL,
      motivation TEXT NOT NULL,
      name TEXT NOT NULL,
      ai_prompt_hint TEXT NOT NULL DEFAULT '',
      recommended_features TEXT NOT NULL DEFAULT '[]',
      sentiment_anchors TEXT NOT NULL DEFAULT '[]',
      orbyt_adapts TEXT NOT NULL DEFAULT '',
      raw_answers TEXT NOT NULL DEFAULT '{}',
      classified_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS onboarding_answers (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      payload TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS card_weights (
      card_id TEXT PRIMARY KEY,
      weight REAL NOT NULL DEFAULT 0.5,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}
