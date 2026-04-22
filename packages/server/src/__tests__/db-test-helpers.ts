import { Database as BunDatabase } from "bun:sqlite"
import { createDatabaseService, type DatabaseService } from "../db/Database.js"
import { runMigrations } from "../db/migrations/runner.js"
import { wrapBunRuntimeSqliteDatabase } from "../db/runtime-sqlite.js"

export function createBunTestDatabase(filename = ":memory:"): BunDatabase {
  return new BunDatabase(filename)
}

export function runBunMigrations(db: BunDatabase): void {
  runMigrations(wrapBunRuntimeSqliteDatabase(db))
}

export function createBunDatabaseService(db: BunDatabase): DatabaseService {
  return createDatabaseService(wrapBunRuntimeSqliteDatabase(db))
}
