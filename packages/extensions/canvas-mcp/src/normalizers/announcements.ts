import {
  Announcement,
  CourseWorkItem,
  type CanvasAnnouncement,
  type CanvasCourse,
} from "@student-claw/contracts"
import { encodeAnnouncementId, encodeCourseId, encodeCourseWorkItemId } from "../ids.js"
import { stripHtml, validateContract } from "../utils.js"

export function normalizeAnnouncement(announcement: CanvasAnnouncement, course: CanvasCourse): Announcement {
  return validateContract(Announcement, {
    id: encodeAnnouncementId(course.id, announcement.id),
    courseId: encodeCourseId(course.id),
    title: announcement.title,
    body: stripHtml(announcement.message),
    postedAt: announcement.posted_at ?? undefined,
    updatedAt: announcement.updated_at ?? undefined,
    contextCode: announcement.context_code,
    htmlUrl: announcement.html_url ?? undefined,
    attachments: (announcement.attachments ?? []).map((attachment) => ({
      id: String(attachment.id),
      filename: attachment.filename,
      displayName: attachment.display_name,
      contentType: attachment.content_type ?? undefined,
      url: attachment.url ?? undefined,
      size: attachment.size ?? undefined,
    })),
  }, "Announcement")
}

export function normalizeAnnouncementCoursework(
  announcement: CanvasAnnouncement,
  course: CanvasCourse,
): CourseWorkItem {
  return validateContract(CourseWorkItem, {
    id: encodeCourseWorkItemId("announcement", course.id, announcement.id),
    courseId: encodeCourseId(course.id),
    title: announcement.title,
    description: stripHtml(announcement.message),
    effectiveDueAt: announcement.posted_at ?? undefined,
    sourceType: "announcement",
    sourceId: String(announcement.id),
    sourceDueDateKind: announcement.posted_at ? "announcement_deadline" : undefined,
    freshnessStatus: "fresh",
    cachedAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    sourceUpdatedAt: announcement.updated_at ?? undefined,
    htmlUrl: announcement.html_url ?? undefined,
  }, "CourseWorkItem")
}
