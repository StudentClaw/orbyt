import type { Database } from "bun:sqlite"

export const version = 11

const ONBOARDING_STEP_NAMES = [
  "welcome",
  "canvas-credential",
  "ai-auth",
  "preferences",
  "routines",
  "first-sync",
  "dashboard-walkthrough",
] as const

const USER_PREFERENCES_COLUMNS = [
  "id",
  "study_times",
  "course_ranking",
  "max_session_mins",
  "off_limit_days",
  "notification_enabled",
  "quiet_hours_start",
  "quiet_hours_end",
  "calendar_integration",
  "updated_at",
] as const

function tableExists(db: Database, tableName: string): boolean {
  return db.query<{ name: string }, [string]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(tableName) !== null
}

function getColumnNames(db: Database, tableName: string): Set<string> {
  if (!tableExists(db, tableName)) return new Set()
  return new Set(
    db.query<{ name: string }, []>(`PRAGMA table_info(${tableName})`)
      .all()
      .map((column) => column.name),
  )
}

function createUserPreferencesTable(db: Database): void {
  db.run(`
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
    )
  `)
}

function createOnboardingStateTable(db: Database): void {
  db.run(`
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
    )
  `)
}

function createOnboardingMetaTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS onboarding_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.run(`
    INSERT OR IGNORE INTO onboarding_meta (key, value)
    VALUES ('overall_status', 'in_progress')
  `)
}

function createRoutinesTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      hour_of_day INTEGER NOT NULL CHECK(hour_of_day BETWEEN 0 AND 23),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(day_of_week, hour_of_day)
    )
  `)
}

function ensureAiAuthStateTable(db: Database): void {
  if (!tableExists(db, "ai_auth_state")) {
    db.run(`
      CREATE TABLE ai_auth_state (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'connected', 'skipped')),
        provider TEXT,
        connected_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  } else {
    const columns = getColumnNames(db, "ai_auth_state")
    if (!columns.has("provider")) {
      db.run("ALTER TABLE ai_auth_state ADD COLUMN provider TEXT")
    }
    if (!columns.has("connected_at")) {
      db.run("ALTER TABLE ai_auth_state ADD COLUMN connected_at TEXT")
    }
    if (!columns.has("updated_at")) {
      db.run("ALTER TABLE ai_auth_state ADD COLUMN updated_at TEXT")
      db.run("UPDATE ai_auth_state SET updated_at = datetime('now') WHERE updated_at IS NULL")
    }
  }

  db.run("INSERT OR IGNORE INTO ai_auth_state (id, status) VALUES (1, 'pending')")
}

function parseJsonArray(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) return "[]"
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? JSON.stringify(parsed) : "[]"
  } catch {
    return "[]"
  }
}

function parseNotificationPrefs(value: unknown): {
  notificationEnabled: number
  quietHoursStart: string
  quietHoursEnd: string
} {
  const defaults = {
    notificationEnabled: 1,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  }

  if (typeof value !== "string" || value.trim().length === 0) return defaults

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return {
      notificationEnabled:
        parsed.notificationEnabled === false || parsed.enabled === false ? 0 : 1,
      quietHoursStart:
        typeof parsed.quietHoursStart === "string" ? parsed.quietHoursStart : defaults.quietHoursStart,
      quietHoursEnd:
        typeof parsed.quietHoursEnd === "string" ? parsed.quietHoursEnd : defaults.quietHoursEnd,
    }
  } catch {
    return defaults
  }
}

function normalizeCalendarIntegration(value: unknown): "none" | "google" | "apple" {
  return value === "google" || value === "apple" ? value : "none"
}

function repairUserPreferencesTable(db: Database): void {
  if (!tableExists(db, "user_preferences")) {
    createUserPreferencesTable(db)
    return
  }

  const columns = getColumnNames(db, "user_preferences")
  const hasCurrentSchema = USER_PREFERENCES_COLUMNS.every((column) => columns.has(column))
  if (hasCurrentSchema) {
    return
  }

  const legacyRow = db.query<Record<string, unknown>, []>(
    "SELECT * FROM user_preferences ORDER BY id LIMIT 1",
  ).get()
  const parsedNotificationPrefs = parseNotificationPrefs(legacyRow?.notification_prefs)

  db.run("ALTER TABLE user_preferences RENAME TO user_preferences_legacy_011")
  createUserPreferencesTable(db)

  if (legacyRow) {
    const hasModernValues = typeof legacyRow.max_session_mins === "number"
    const maxSessionMins = typeof legacyRow.max_session_mins === "number" ? legacyRow.max_session_mins : 90
    const updatedAt = typeof legacyRow.updated_at === "string" ? legacyRow.updated_at : new Date().toISOString()
    db.run(
      `INSERT INTO user_preferences
        (id, study_times, course_ranking, max_session_mins, off_limit_days,
         notification_enabled, quiet_hours_start, quiet_hours_end, calendar_integration, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        1,
        parseJsonArray(legacyRow.study_times),
        parseJsonArray(legacyRow.course_ranking),
        maxSessionMins,
        hasModernValues ? parseJsonArray(legacyRow.off_limit_days) : "[]",
        hasModernValues
          ? (typeof legacyRow.notification_enabled === "number" && legacyRow.notification_enabled === 0 ? 0 : 1)
          : parsedNotificationPrefs.notificationEnabled,
        hasModernValues && typeof legacyRow.quiet_hours_start === "string"
          ? legacyRow.quiet_hours_start
          : parsedNotificationPrefs.quietHoursStart,
        hasModernValues && typeof legacyRow.quiet_hours_end === "string"
          ? legacyRow.quiet_hours_end
          : parsedNotificationPrefs.quietHoursEnd,
        normalizeCalendarIntegration(legacyRow.calendar_integration),
        updatedAt,
      ],
    )
  }

  db.run("DROP TABLE user_preferences_legacy_011")
}

function repairOnboardingStateTable(db: Database): void {
  if (!tableExists(db, "onboarding_state")) {
    createOnboardingStateTable(db)
    return
  }

  const columns = getColumnNames(db, "onboarding_state")
  const hasCurrentSchema = columns.has("step_name") && columns.has("status") && columns.has("completed_at")
  if (hasCurrentSchema) {
    return
  }

  const legacyRows = columns.has("step")
    ? db.query<{ step: number; status: string; completed_at: string | null }, []>(
      "SELECT step, status, completed_at FROM onboarding_state ORDER BY step",
    ).all()
    : []

  db.run("ALTER TABLE onboarding_state RENAME TO onboarding_state_legacy_011")
  createOnboardingStateTable(db)

  for (const row of legacyRows) {
    const stepName = ONBOARDING_STEP_NAMES[row.step]
    if (!stepName) continue
    db.run(
      `INSERT INTO onboarding_state (step_name, status, completed_at)
       VALUES (?, ?, ?)
       ON CONFLICT(step_name) DO UPDATE SET status = excluded.status, completed_at = excluded.completed_at`,
      [stepName, row.status, row.completed_at],
    )
  }

  db.run("DROP TABLE onboarding_state_legacy_011")
}

function repairRoutinesTable(db: Database): void {
  if (!tableExists(db, "routines")) {
    createRoutinesTable(db)
    return
  }

  const columns = getColumnNames(db, "routines")
  if (columns.has("day_of_week") && columns.has("hour_of_day")) {
    return
  }

  db.run("DROP TABLE routines")
  createRoutinesTable(db)
}

export function run(db: Database): void {
  repairUserPreferencesTable(db)
  repairOnboardingStateTable(db)
  createOnboardingMetaTable(db)
  repairRoutinesTable(db)
  ensureAiAuthStateTable(db)
}
