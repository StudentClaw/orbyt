import { Context, Layer, Effect } from "effect"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { homedir } from "node:os"
import { ConfigService } from "../config/ConfigService.js"
import { runMigrations } from "./migrations/runner.js"
import { type RuntimeSqliteDatabase, type SqliteQueryBindings, openRuntimeSqliteDatabase } from "./runtime-sqlite.js"

/**
 * SQLite access helpers used by the server runtime.
 */
export interface DatabaseService {
  readonly get: <T>(sql: string, params?: SqliteQueryBindings) => T | null
  readonly query: <T>(sql: string, params?: SqliteQueryBindings) => T[]
  readonly execute: (sql: string, params?: SqliteQueryBindings) => void
  readonly transaction: <T>(fn: () => T) => T
  readonly close: () => void
}

export function createDatabaseService(db: RuntimeSqliteDatabase): DatabaseService {
  return {
    get: <T>(sql: string, params: SqliteQueryBindings = []): T | null =>
      db.query<T>(sql).get(...params),
    query: <T>(sql: string, params: SqliteQueryBindings = []): T[] =>
      db.query<T>(sql).all(...params),
    execute: (sql: string, params: SqliteQueryBindings = []): void => {
      db.run(sql, params)
    },
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
    close: () => db.close(),
  }
}

/**
 * Effect service tag for the initialized SQLite database.
 */
export class Database extends Context.Tag("Database")<
  Database,
  DatabaseService
>() {}

/**
 * Opens the configured SQLite database, applies migrations, and exposes typed helpers.
 */
export const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* ConfigService

    const dbPath = config.dbPath.replace(/^~/, homedir())
    mkdirSync(dirname(dbPath), { recursive: true })
    const db: RuntimeSqliteDatabase = yield* Effect.promise(() => openRuntimeSqliteDatabase(dbPath))
    db.run("PRAGMA journal_mode = WAL")
    db.run("PRAGMA foreign_keys = ON")

    runMigrations(db)

    return createDatabaseService(db)
  }),
)
