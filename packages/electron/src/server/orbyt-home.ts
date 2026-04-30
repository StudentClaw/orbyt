import path from "node:path"

/**
 * Resolves the directory used as $ORBYT_HOME for the spawned server process.
 * Mirrors the logic in spawnServer() so callers in the main process can write
 * files (e.g. canvas-credentials.json) to the same location the server reads.
 */
export function resolveOrbytHome(): string {
  const explicit = process.env.ORBYT_HOME?.trim()
  if (explicit) return explicit
  const dbPath = process.env.DB_PATH ?? `${process.env.HOME}/.orbyt/data.db`
  return path.dirname(dbPath)
}
