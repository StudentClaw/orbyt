import path from "node:path"
import os from "node:os"
import { existsSync } from "node:fs"
import { DatabaseSync, type SQLInputValue } from "node:sqlite"

type Row = Record<string, unknown>

export type CourseRow = {
  id: string
  name: string
  code: string | null
  professor: string | null
  canvas_id: string | null
  term: string | null
  last_sync_at: string | null
}

export type CourseworkRow = {
  id: string
  course_id: string
  title: string
  description: string | null
  effective_due_at: string | null
  source_type: string
  source_due_date_kind: string | null
  freshness_status: string | null
  cached_at: string | null
  last_verified_at: string | null
  source_updated_at: string | null
  points_possible: number | null
  submission_status: string | null
  grade: string | null
  html_url: string | null
  canvas_assignment_id: string | null
  is_upcoming: number | null
  status_bucket: string | null
}

export type CourseGradeSummaryRow = {
  course_id: string
  current_score: number | null
  current_grade: string | null
  final_score: number | null
  final_grade: string | null
  units: number | null
}

export type TodoItemRow = {
  course_id: string | null
  title: string
  type: string
  due_at: string | null
  html_url: string | null
}

export type PeerReviewTodoRow = {
  course_id: string
  assignment_id: string
  assignment_name: string
  reviewee_user_id: string | null
  assessor_user_id: string | null
  workflow_state: string | null
}

export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.ORBYT_DB_PATH ?? env.DB_PATH
  if (explicit && explicit.length > 0) {
    return expandHome(explicit)
  }
  const orbytHome = env.ORBYT_HOME ?? path.join(os.homedir(), ".orbyt")
  return path.join(orbytHome, "data.db")
}

function expandHome(input: string): string {
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2))
  }
  return input
}

export class CanvasCacheReader {
  readonly #db: DatabaseSync

  constructor(dbPath: string) {
    if (!existsSync(dbPath)) {
      throw new Error(`canvas-mcp: database not found at ${dbPath}`)
    }
    this.#db = new DatabaseSync(dbPath, { readOnly: true })
  }

  query<T extends Row>(sql: string, params: SQLInputValue[] = []): T[] {
    const stmt = this.#db.prepare(sql)
    return stmt.all(...params) as T[]
  }

  close(): void {
    this.#db.close()
  }

  listCourseRows(): CourseRow[] {
    return this.query<CourseRow>(
      `SELECT id, name, code, professor, canvas_id, term, last_sync_at
         FROM courses
        ORDER BY name ASC`,
    )
  }

  listCourseworkRows(): CourseworkRow[] {
    return this.query<CourseworkRow>(
      `SELECT id, course_id, title, description, effective_due_at, source_type,
              source_due_date_kind, freshness_status, cached_at, last_verified_at,
              source_updated_at, points_possible, submission_status, grade, html_url,
              canvas_assignment_id, is_upcoming, status_bucket
         FROM coursework_items
        ORDER BY effective_due_at ASC NULLS LAST`,
    )
  }

  listCourseGradeRows(): CourseGradeSummaryRow[] {
    return this.query<CourseGradeSummaryRow>(
      `SELECT course_id, current_score, current_grade, final_score, final_grade, units
         FROM canvas_course_grade_summaries
        ORDER BY course_id ASC`,
    )
  }

  listTodoItemRows(): TodoItemRow[] {
    return this.query<TodoItemRow>(
      `SELECT course_id, title, type, due_at, html_url
         FROM canvas_todo_items
        ORDER BY due_at ASC NULLS LAST`,
    )
  }

  listPeerReviewTodoRows(): PeerReviewTodoRow[] {
    return this.query<PeerReviewTodoRow>(
      `SELECT course_id, assignment_id, assignment_name, reviewee_user_id,
              assessor_user_id, workflow_state
         FROM canvas_peer_review_todo
        ORDER BY assignment_name ASC`,
    )
  }
}
