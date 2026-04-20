import type { DatabaseService } from "../db/Database.js"

type CourseRow = {
  id: string
  name: string
  code: string
}

export function readCourseContext(db: DatabaseService): string {
  const rows = db.query<CourseRow>(
    `SELECT id, name, code FROM courses ORDER BY name ASC`,
  )
  if (rows.length === 0) return "_none yet_"
  return rows.map((r) => `- ${r.code}: ${r.name}`).join("\n")
}
