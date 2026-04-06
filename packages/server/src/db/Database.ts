import { Context, Layer, Effect } from "effect"
import { Database as BunDatabase } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { homedir } from "node:os"
import { ConfigService } from "../config/ConfigService.js"
import { runMigrations } from "./migrations/runner.js"

export interface DatabaseService {
  readonly db: BunDatabase
  readonly query: <T>(sql: string, params?: unknown[]) => T[]
  readonly execute: (sql: string, params?: unknown[]) => void
  readonly close: () => void
}

export class Database extends Context.Tag("Database")<
  Database,
  DatabaseService
>() {}

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
      query: <T>(sql: string, params: unknown[] = []): T[] =>
        db.query(sql).all(...params) as T[],
      execute: (sql: string, params: unknown[] = []): void => {
        db.run(sql, params)
      },
      close: () => db.close(),
    }
  }),
)
