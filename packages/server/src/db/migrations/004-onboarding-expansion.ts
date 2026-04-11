export const version = 4

export const up = `
  DROP TABLE IF EXISTS onboarding_state;

  CREATE TABLE onboarding_state (
    step_name TEXT PRIMARY KEY
      CHECK(step_name IN (
        'welcome',
        'canvas-credential',
        'ai-auth',
        'preferences',
        'routines',
        'first-sync',
        'dashboard-walkthrough'
      )),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'completed', 'skipped')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS onboarding_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO onboarding_meta (key, value)
    VALUES ('overall_status', 'in_progress');

  -- Ensure the old table exists before renaming (handles DBs created without migration 001)
  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    study_times TEXT,
    course_ranking TEXT,
    notification_prefs TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  ALTER TABLE user_preferences RENAME TO user_preferences_legacy;

  CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    study_times TEXT NOT NULL DEFAULT '[]',
    course_ranking TEXT NOT NULL DEFAULT '[]',
    max_session_mins INTEGER NOT NULL DEFAULT 90,
    off_limit_days TEXT NOT NULL DEFAULT '[]',
    notification_enabled INTEGER NOT NULL DEFAULT 1,
    quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
    quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
    calendar_integration TEXT NOT NULL DEFAULT 'none'
      CHECK(calendar_integration IN ('none', 'google', 'apple')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT INTO user_preferences
    (id, study_times, course_ranking, max_session_mins, off_limit_days,
     notification_enabled, quiet_hours_start, quiet_hours_end, calendar_integration)
  SELECT
    1,
    COALESCE(study_times, '[]'),
    COALESCE(course_ranking, '[]'),
    90,
    '[]',
    1,
    COALESCE(json_extract(notification_prefs, '$.quietHoursStart'), '22:00'),
    COALESCE(json_extract(notification_prefs, '$.quietHoursEnd'), '08:00'),
    'none'
  FROM user_preferences_legacy
  LIMIT 1;

  DROP TABLE user_preferences_legacy;

  CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    hour_of_day INTEGER NOT NULL CHECK(hour_of_day BETWEEN 0 AND 23),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(day_of_week, hour_of_day)
  );

  CREATE TABLE IF NOT EXISTS ai_auth_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'connected', 'skipped')),
    provider TEXT,
    connected_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO ai_auth_state (id, status) VALUES (1, 'pending');
`
