import { Context, Layer, Effect } from "effect"
import { Database as BunDatabase, type SQLQueryBindings } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { homedir } from "node:os"
import { ConfigService } from "../config/ConfigService.js"
import { runMigrations } from "./migrations/runner.js"

/**
 * SQLite access helpers used by the server runtime.
 */
export interface DatabaseService {
  readonly db: BunDatabase
  readonly get: <T>(sql: string, params?: SQLQueryBindings[]) => T | null
  readonly query: <T>(sql: string, params?: SQLQueryBindings[]) => T[]
  readonly execute: (sql: string, params?: SQLQueryBindings[]) => void
  readonly transaction: <T>(fn: () => T) => T
  readonly close: () => void
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
    const db = new BunDatabase(dbPath)
    db.run("PRAGMA journal_mode = WAL")
    db.run("PRAGMA foreign_keys = ON")

    runMigrations(db)

    return {
      db,
      get: <T>(sql: string, params: SQLQueryBindings[] = []): T | null =>
        (db.query(sql).get(...params) as T | null) ?? null,
      query: <T>(sql: string, params: SQLQueryBindings[] = []): T[] =>
        db.query(sql).all(...params) as T[],
      execute: (sql: string, params: SQLQueryBindings[] = []): void => {
        db.run(sql, params)
      },
      transaction: <T>(fn: () => T): T => db.transaction(fn)(),
      close: () => db.close(),
    }
  }),
)
