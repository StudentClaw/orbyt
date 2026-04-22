import process from "node:process"
import type { SQLQueryBindings as BunSqliteBinding } from "bun:sqlite"

export type SqliteBindingValue = BunSqliteBinding
export type SqliteQueryBindings = SqliteBindingValue[]

export type RuntimeSqliteStatement<T> = {
  get: (...params: SqliteQueryBindings) => T | null
  all: (...params: SqliteQueryBindings) => T[]
}

export type RuntimeSqliteDatabase = {
  run: (sql: string, params?: SqliteQueryBindings) => void
  query: <T>(sql: string) => RuntimeSqliteStatement<T>
  transaction: <T>(fn: () => T) => () => T
  close: () => void
}

export function supportsNodeSqliteRuntimeVersion(version = process.versions.node): boolean {
  const [majorPart, minorPart] = version.split(".")
  const major = Number.parseInt(majorPart ?? "0", 10)
  const minor = Number.parseInt(minorPart ?? "0", 10)

  if (major >= 24) {
    return true
  }

  if (major === 23) {
    return minor >= 11
  }

  if (major === 22) {
    return minor >= 16
  }

  return false
}

export function createNodeSqliteVersionError(version = process.versions.node): Error {
  return new Error(
    `Packaged Student Claw requires Node.js with node:sqlite support (>=22.16, >=23.11, or >=24). Current runtime: ${version}`,
  )
}

function createNodeRuntimeDatabase(
  db: import("node:sqlite").DatabaseSync,
): RuntimeSqliteDatabase {
  return {
    run(sql, params = []) {
      if (params.length === 0) {
        db.exec(sql)
        return
      }

      db.prepare(sql).run(...(params as import("node:sqlite").SQLInputValue[]))
    },
    query<T>(sql: string): RuntimeSqliteStatement<T> {
      const statement = db.prepare(sql)
      return {
        get: (...params) => (statement.get(...(params as import("node:sqlite").SQLInputValue[])) as T | undefined) ?? null,
        all: (...params) => statement.all(...(params as import("node:sqlite").SQLInputValue[])) as T[],
      }
    },
    transaction<T>(fn: () => T): () => T {
      return () => {
        db.exec("BEGIN IMMEDIATE")
        try {
          const result = fn()
          db.exec("COMMIT")
          return result
        } catch (error) {
          try {
            db.exec("ROLLBACK")
          } catch {
            // Ignore rollback failures so the original error wins.
          }
          throw error
        }
      }
    },
    close() {
      db.close()
    },
  }
}

export function wrapBunRuntimeSqliteDatabase(
  db: import("bun:sqlite").Database,
): RuntimeSqliteDatabase {
  return {
    run(sql, params = []) {
      db.run(sql, params as never)
    },
    query<T>(sql: string): RuntimeSqliteStatement<T> {
      const statement = db.query<T, BunSqliteBinding[]>(sql)
      return {
        get: (...params) => statement.get(...params) ?? null,
        all: (...params) => statement.all(...params),
      }
    },
    transaction<T>(fn: () => T): () => T {
      return db.transaction(fn)
    },
    close() {
      db.close()
    },
  }
}

export async function openRuntimeSqliteDatabase(dbPath: string): Promise<RuntimeSqliteDatabase> {
  if (process.versions.bun) {
    const { Database } = await import("bun:sqlite")
    return wrapBunRuntimeSqliteDatabase(new Database(dbPath))
  }

  if (!supportsNodeSqliteRuntimeVersion()) {
    throw createNodeSqliteVersionError()
  }

  const { DatabaseSync } = await import("node:sqlite")
  return createNodeRuntimeDatabase(new DatabaseSync(dbPath))
}
