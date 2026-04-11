import { CanvasApiError, type CanvasCourseworkDetail, type CanvasCourse } from "@student-claw/contracts"
import { CanvasClient } from "../canvas-client.js"
import { decodeCourseWorkItemId } from "../ids.js"
import { normalizeAnnouncementCoursework } from "../normalizers/announcements.js"
import { normalizeAssignment, normalizeGrade } from "../normalizers/assignments.js"
import { normalizeModuleItem } from "../normalizers/modules.js"
import { normalizePage } from "../normalizers/pages.js"

type DetailReference =
  | { courseWorkItemId: string }
  | { sourceType: "assignment" | "module" | "page" | "announcement"; sourceId: string }

export async function getCourseworkDetail(
  client: CanvasClient,
  courses: CanvasCourse[],
  reference: DetailReference,
): Promise<CanvasCourseworkDetail> {
  const decoded = "courseWorkItemId" in reference ? decodeCourseWorkItemId(reference.courseWorkItemId) : null
  const sourceType = decoded?.sourceType ?? ("sourceType" in reference ? reference.sourceType : undefined)
  const sourceId = decoded?.sourceId ?? ("sourceId" in reference ? reference.sourceId : undefined)
  const courseCandidates = decoded
    ? courses.filter((course) => String(course.id) === decoded.canvasCourseId)
    : courses

  if (!sourceType || !sourceId) {
    throw new CanvasApiError({
      message: "Canvas coursework detail reference was incomplete.",
      statusCode: 400,
    })
  }

  for (const course of courseCandidates) {
    if (sourceType === "assignment") {
      const assignment = await tryGetAssignment(client, course, sourceId)
      if (!assignment) {
        continue
      }

      const submission = await safeGetSubmission(client, course, sourceId)
      return {
        item: normalizeAssignment(assignment, course, submission ?? undefined),
        source: assignment,
        submission: submission ?? undefined,
        grade: submission ? normalizeGrade(course, assignment, submission) ?? undefined : undefined,
      }
    }

    if (sourceType === "module") {
      const moduleItem = await tryGetModuleItem(client, course, sourceId)
      if (!moduleItem) {
        continue
      }

      return {
        item: normalizeModuleItem(moduleItem, course),
        source: moduleItem,
      }
    }

    if (sourceType === "page") {
      const page = await tryGetPage(client, course, sourceId)
      if (!page) {
        continue
      }

      return {
        item: normalizePage(page, course),
        source: page,
      }
    }

    if (sourceType === "announcement") {
      const announcement = await tryGetAnnouncement(client, course, sourceId)
      if (!announcement) {
        continue
      }

      return {
        item: normalizeAnnouncementCoursework(announcement, course),
        source: announcement,
      }
    }
  }

  throw new CanvasApiError({
    message: `Unable to find Canvas coursework detail for ${sourceType}:${sourceId}.`,
    statusCode: 404,
  })
}

async function tryGetAssignment(client: CanvasClient, course: CanvasCourse, sourceId: string) {
  try {
    return await client.getAssignment(String(course.id), sourceId)
  } catch (error) {
    if (error instanceof CanvasApiError && error.statusCode === 404) {
      return null
    }
    throw error
  }
}

async function safeGetSubmission(client: CanvasClient, course: CanvasCourse, assignmentId: string) {
  try {
    return await client.getSubmission(String(course.id), assignmentId)
  } catch (error) {
    if (error instanceof CanvasApiError && error.statusCode === 404) {
      return null
    }
    throw error
  }
}

async function tryGetModuleItem(client: CanvasClient, course: CanvasCourse, sourceId: string) {
  const modules = await client.getModules(String(course.id))
  for (const module of modules) {
    const items = await client.getModuleItems(String(course.id), String(module.id))
    const found = items.find((item) => String(item.id) === sourceId)
    if (found) {
      return found
    }
  }
  return null
}

async function tryGetPage(client: CanvasClient, course: CanvasCourse, sourceId: string) {
  try {
    return await client.getPage(String(course.id), sourceId)
  } catch (error) {
    if (error instanceof CanvasApiError && error.statusCode === 404) {
      return null
    }
    throw error
  }
}

async function tryGetAnnouncement(client: CanvasClient, course: CanvasCourse, sourceId: string) {
  const announcements = await client.getAnnouncements(String(course.id))
  return announcements.find((announcement) => String(announcement.id) === sourceId) ?? null
}
