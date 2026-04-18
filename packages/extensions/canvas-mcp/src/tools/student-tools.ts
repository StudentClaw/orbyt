import { mkdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
  CanvasAssignmentDetailsResult,
  CanvasConversationLookupResult,
  CanvasCourseContentOverviewResult,
  CanvasCourseDetailsResult,
  CanvasCourseStructureResult,
  CanvasDiscussionEntryLookupResult,
  CanvasDiscussionTopicLookupResult,
  CanvasDownloadCourseFileResult,
  CanvasGetDiscussionWithRepliesResult,
  CanvasGetFrontPageResult,
  CanvasGetMyCourseGradesResult,
  CanvasGetMyPeerReviewsTodoResult,
  CanvasGetMySubmissionStatusResult,
  CanvasGetMyTodoItemsResult,
  CanvasGetMyUpcomingAssignmentsResult,
  CanvasGetUnreadCountResult,
  CanvasListAssignmentsResult,
  CanvasListConversationsResult,
  CanvasListCourseFilesResult,
  CanvasListCoursesResult,
  CanvasListDiscussionEntriesResult,
  CanvasListDiscussionTopicsResult,
  CanvasListModuleItemsResult,
  CanvasListModulesResult,
  CanvasListPagesResult,
  CanvasMarkConversationsReadResult,
  CanvasPageLookupResult,
  CanvasPostDiscussionEntryResult,
  CanvasReplyToDiscussionEntryResult,
  CanvasSearchCanvasToolsResult,
  type CanvasAssignmentWithSubmission,
  type CanvasCourse,
  type CanvasDiscussionEntry,
  type CanvasDiscussionTopic,
  type CanvasFile,
  type CanvasModule,
  type CanvasModuleItem,
} from "@student-claw/contracts"
import { decodeCourseId, encodeCourseId } from "../ids.js"
import { normalizeAssignment, normalizeCourse, normalizeGrade } from "../normalizers/assignments.js"
import {
  errorResult,
  getCanvasClient,
  getCanvasClientForBaseUrl,
  getWorkspaceRoot,
  getWritableRoots,
  isNotFoundError,
  isPermissionError,
  requireCourse,
  resolveCourses,
  successResult,
  type CanvasToolDependencies,
} from "./shared.js"
import { sortCoursework } from "../utils.js"
import { canvasStudentReplacementToolInventory } from "../student-tool-contract.js"

export function registerStudentCanvasTools(server: McpServer, deps: CanvasToolDependencies): void {
  registerStudentSelfTools(server, deps)
  registerStudentReadTools(server, deps)
  registerStudentActionTools(server, deps)
}

function registerStudentSelfTools(server: McpServer, deps: CanvasToolDependencies): void {
  server.registerTool(
    "get_my_upcoming_assignments",
    {
      title: "Get my upcoming assignments",
      description: "List upcoming assignments across the student's active Canvas courses.",
      inputSchema: {
        days: z.number().int().positive().optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ days }) => {
      try {
        const client = getCanvasClient(deps)
        const courses = await client.getCourses()
        const courseMap = new Map(courses.map((course) => [String(course.id), course]))
        const horizon = typeof days === "number" ? deps.now().getTime() + days * 24 * 60 * 60 * 1000 : null
        const items = sortCoursework(
          (await client.getUpcomingEvents())
            .map((event) => {
              const assignment = extractUpcomingEventAssignment(event)
              const course = assignment ? courseMap.get(String(assignment.course_id)) : undefined
              return assignment && course ? normalizeAssignment({
                id: assignment.id,
                course_id: assignment.course_id,
                name: assignment.name,
                due_at: assignment.due_at ?? undefined,
                points_possible: assignment.points_possible ?? undefined,
                html_url: assignment.html_url ?? undefined,
                updated_at: assignment.updated_at ?? undefined,
              }, course) : null
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .filter((item) => {
              if (horizon === null || !item.effectiveDueAt) {
                return true
              }
              const dueAt = Date.parse(item.effectiveDueAt)
              return Number.isFinite(dueAt) && dueAt <= horizon
            }),
        )

        return successResult(CanvasGetMyUpcomingAssignmentsResult, { items }, "CanvasGetMyUpcomingAssignmentsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_my_submission_status",
    {
      title: "Get my submission status",
      description: "Show the student's submitted, pending, and overdue assignment status.",
      inputSchema: {
        courseId: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        const courses = await resolveCourses(client, courseId)
        const submitted = []
        const pending = []
        const overdue = []
        const now = deps.now().getTime()

        for (const course of courses) {
          let assignments: CanvasAssignmentWithSubmission[]
          try {
            assignments = await client.getAssignmentsWithSubmission(String(course.id))
          } catch (error) {
            if (isPermissionError(error)) {
              continue
            }
            throw error
          }

          for (const assignment of assignments) {
            if (assignment.published === false) {
              continue
            }

            const item = normalizeAssignment(assignment, course, assignment.submission ?? undefined)
            const workflowState = assignment.submission?.workflow_state ?? ""
            const isSubmitted = ["submitted", "graded", "complete", "completed"].includes(workflowState)
              || !!assignment.submission?.submitted_at
            const dueAt = item.effectiveDueAt ? Date.parse(item.effectiveDueAt) : Number.NaN
            const isOverdue = !isSubmitted && Number.isFinite(dueAt) && dueAt < now

            if (isSubmitted) {
              submitted.push(item)
            } else if (isOverdue) {
              overdue.push(item)
            } else {
              pending.push(item)
            }
          }
        }

        return successResult(CanvasGetMySubmissionStatusResult, {
          submitted: sortCoursework(submitted),
          pending: sortCoursework(pending),
          overdue: sortCoursework(overdue),
        }, "CanvasGetMySubmissionStatusResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_my_course_grades",
    {
      title: "Get my course grades",
      description: "Show the student's current grades across active Canvas courses.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const client = getCanvasClient(deps)
        const courses = await client.getCoursesWithEnrollments()
        const summaries = courses.map((course) => {
          const enrollment = course.enrollments?.[0]
          return {
            course: normalizeCourse(course),
            currentScore: enrollment?.grades?.current_score ?? enrollment?.computed_current_score ?? undefined,
            currentGrade: enrollment?.grades?.current_grade ?? enrollment?.computed_current_grade ?? undefined,
            finalScore: enrollment?.grades?.final_score ?? enrollment?.computed_final_score ?? undefined,
            finalGrade: enrollment?.grades?.final_grade ?? enrollment?.computed_final_grade ?? undefined,
          }
        })

        return successResult(CanvasGetMyCourseGradesResult, { courses: summaries }, "CanvasGetMyCourseGradesResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_my_todo_items",
    {
      title: "Get my todo items",
      description: "List the student's current Canvas todo items.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const client = getCanvasClient(deps)
        const items = (await client.getTodoItems()).map((item) => ({
          courseId: item.course_id ? encodeCourseId(item.course_id) : undefined,
          title: item.assignment?.name ?? item.title ?? "Untitled Canvas todo",
          type: item.type ?? "unknown",
          dueAt: item.assignment?.due_at ?? undefined,
          htmlUrl: item.assignment?.html_url ?? item.html_url ?? undefined,
        }))

        return successResult(CanvasGetMyTodoItemsResult, { items }, "CanvasGetMyTodoItemsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_my_peer_reviews_todo",
    {
      title: "Get my peer reviews todo",
      description: "List peer reviews the student still needs to complete.",
      inputSchema: {
        courseId: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        const courses = await resolveCourses(client, courseId)
        const items = []

        for (const course of courses) {
          let assignments: CanvasAssignmentWithSubmission[]
          try {
            assignments = await client.getAssignmentsWithSubmission(String(course.id))
          } catch (error) {
            if (isPermissionError(error)) {
              continue
            }
            throw error
          }

          for (const assignment of assignments.filter((candidate) => candidate.peer_reviews)) {
            let reviews
            try {
              reviews = await client.getPeerReviews(String(course.id), String(assignment.id))
            } catch (error) {
              if (isPermissionError(error)) {
                continue
              }
              throw error
            }

            for (const review of reviews.filter((candidate) => candidate.workflow_state !== "completed")) {
              items.push({
                courseId: encodeCourseId(course.id),
                assignmentId: String(assignment.id),
                assignmentName: assignment.name,
                revieweeUserId: review.user_id !== null && review.user_id !== undefined ? String(review.user_id) : undefined,
                assessorUserId: review.assessor_id !== null && review.assessor_id !== undefined ? String(review.assessor_id) : undefined,
                workflowState: review.workflow_state ?? undefined,
              })
            }
          }
        }

        return successResult(CanvasGetMyPeerReviewsTodoResult, { items }, "CanvasGetMyPeerReviewsTodoResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}

function registerStudentReadTools(server: McpServer, deps: CanvasToolDependencies): void {
  server.registerTool(
    "list_courses",
    {
      title: "List Canvas courses",
      description: "List Canvas courses visible to the authenticated student.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const client = getCanvasClient(deps)
        const courses = (await client.getCourses()).map(normalizeCourse)
        return successResult(CanvasListCoursesResult, { courses }, "CanvasListCoursesResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_course_details",
    {
      title: "Get course details",
      description: "Fetch detailed information for one Canvas course.",
      inputSchema: {
        courseId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        return successResult(CanvasCourseDetailsResult, {
          course: normalizeCourse(course),
          rawCourse: course,
        }, "CanvasCourseDetailsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_course_content_overview",
    {
      title: "Get course content overview",
      description: "Summarize pages, modules, and front-page content for a Canvas course.",
      inputSchema: {
        courseId: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        if (courseId) {
          const course = await requireCourse(client, courseId)
          const overview = await buildCourseContentOverview(client, course)
          return successResult(CanvasCourseContentOverviewResult, {
            ...overview,
            courses: undefined,
          }, "CanvasCourseContentOverviewResult")
        }

        const overviews = await Promise.all(
          (await resolveCourses(client)).map((course) => buildCourseContentOverview(client, course)),
        )

        return successResult(CanvasCourseContentOverviewResult, {
          course: undefined,
          pageCount: overviews.reduce((total, course) => total + course.pageCount, 0),
          moduleCount: overviews.reduce((total, course) => total + course.moduleCount, 0),
          moduleItemCount: overviews.reduce((total, course) => total + course.moduleItemCount, 0),
          frontPage: undefined,
          courses: overviews,
        }, "CanvasCourseContentOverviewResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "list_pages",
    {
      title: "List course pages",
      description: "List readable pages in a Canvas course.",
      inputSchema: {
        courseId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const pages = await client.getPages(String(course.id))
        return successResult(CanvasListPagesResult, {
          course: normalizeCourse(course),
          pages,
        }, "CanvasListPagesResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  const registerPageLookup = (name: "get_page_content" | "get_page_details", title: string) => {
    server.registerTool(
      name,
      {
        title,
        description: "Fetch a readable Canvas page.",
        inputSchema: {
          courseId: z.string(),
          pageId: z.string(),
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async ({ courseId, pageId }) => {
        try {
          const client = getCanvasClient(deps)
          const course = await requireCourse(client, courseId)
          const page = await client.getPage(String(course.id), pageId)
          return successResult(CanvasPageLookupResult, {
            course: normalizeCourse(course),
            page,
          }, "CanvasPageLookupResult")
        } catch (error) {
          return errorResult(error)
        }
      },
    )
  }

  registerPageLookup("get_page_content", "Get page content")
  registerPageLookup("get_page_details", "Get page details")

  server.registerTool(
    "get_front_page",
    {
      title: "Get front page",
      description: "Fetch the front page for a Canvas course when it is visible to the student.",
      inputSchema: {
        courseId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const page = await client.getFrontPage(String(course.id))
        return successResult(CanvasGetFrontPageResult, {
          course: normalizeCourse(course),
          page,
        }, "CanvasGetFrontPageResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "list_assignments",
    {
      title: "List assignments",
      description: "List assignments visible to the student in a Canvas course.",
      inputSchema: {
        courseId: z.string().optional(),
        includeCompleted: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId, includeCompleted }) => {
      try {
        const client = getCanvasClient(deps)
        if (courseId) {
          const course = await requireCourse(client, courseId)
          const items = await buildCourseAssignments(client, course, includeCompleted)
          return successResult(CanvasListAssignmentsResult, {
            course: normalizeCourse(course),
            items,
            courses: undefined,
          }, "CanvasListAssignmentsResult")
        }

        const courses = await resolveCourses(client)
        const buckets = []

        for (const course of courses) {
          buckets.push({
            course: normalizeCourse(course),
            items: await swallowPermission(
              () => buildCourseAssignments(client, course, includeCompleted),
              [],
            ),
          })
        }

        return successResult(CanvasListAssignmentsResult, {
          course: undefined,
          items: sortCoursework(buckets.flatMap((bucket) => bucket.items)),
          courses: buckets,
        }, "CanvasListAssignmentsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_assignment_details",
    {
      title: "Get assignment details",
      description: "Fetch details for a Canvas assignment visible to the student from IDs or a full Canvas assignment URL.",
      inputSchema: {
        courseId: z.union([z.string(), z.number()]).optional(),
        assignmentId: z.union([z.string(), z.number()]).optional(),
        assignmentUrl: z.string().optional(),
        assignment_url: z.string().optional(),
        url: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId, assignmentId, assignmentUrl, assignment_url, url }) => {
      try {
        const reference = resolveAssignmentReference({ courseId, assignmentId, assignmentUrl, assignment_url, url })
        const client = getCanvasClientForBaseUrl(deps, reference.baseUrl)
        const course = await resolveAssignmentCourse(client, reference.courseId)
        const assignment = await client.getAssignmentWithSubmission(String(course.id), reference.assignmentId)
        const item = normalizeAssignment(assignment, course, assignment.submission ?? undefined)
        const grade = assignment.submission ? normalizeGrade(course, assignment, assignment.submission) ?? undefined : undefined

        return successResult(CanvasAssignmentDetailsResult, {
          course: normalizeCourse(course),
          item,
          source: assignment,
          grade,
        }, "CanvasAssignmentDetailsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "list_modules",
    {
      title: "List modules",
      description: "List readable modules in a Canvas course.",
      inputSchema: {
        courseId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const modules = await client.getModules(String(course.id))
        return successResult(CanvasListModulesResult, {
          course: normalizeCourse(course),
          modules,
        }, "CanvasListModulesResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "list_module_items",
    {
      title: "List module items",
      description: "List readable module items for a Canvas module.",
      inputSchema: {
        courseId: z.string(),
        moduleId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId, moduleId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const module = await requireModule(client, course, moduleId)
        const items = await client.getModuleItems(String(course.id), moduleId)
        return successResult(CanvasListModuleItemsResult, {
          course: normalizeCourse(course),
          module,
          items,
        }, "CanvasListModuleItemsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_course_structure",
    {
      title: "Get course structure",
      description: "Return the readable module and item structure for a Canvas course.",
      inputSchema: {
        courseId: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        if (courseId) {
          const course = await requireCourse(client, courseId)
          const structure = await buildCourseStructure(client, course)
          return successResult(CanvasCourseStructureResult, {
            ...structure,
            courses: undefined,
          }, "CanvasCourseStructureResult")
        }

        const structures = await Promise.all(
          (await resolveCourses(client)).map((course) => buildCourseStructure(client, course)),
        )

        return successResult(CanvasCourseStructureResult, {
          course: undefined,
          modules: [],
          courses: structures,
        }, "CanvasCourseStructureResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "list_course_files",
    {
      title: "List course files",
      description: "List Canvas files visible to the student in a course.",
      inputSchema: {
        courseId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const files = await client.getCourseFiles(String(course.id))
        return successResult(CanvasListCourseFilesResult, {
          course: normalizeCourse(course),
          files,
        }, "CanvasListCourseFilesResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "list_discussion_topics",
    {
      title: "List discussion topics",
      description: "List discussion topics visible to the student in a Canvas course.",
      inputSchema: {
        courseId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const topics = await client.getDiscussionTopics(String(course.id))
        return successResult(CanvasListDiscussionTopicsResult, {
          course: normalizeCourse(course),
          topics,
        }, "CanvasListDiscussionTopicsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_discussion_topic_details",
    {
      title: "Get discussion topic details",
      description: "Fetch metadata for a readable Canvas discussion topic.",
      inputSchema: {
        courseId: z.string(),
        topicId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId, topicId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const topic = await client.getDiscussionTopic(String(course.id), topicId)
        return successResult(CanvasDiscussionTopicLookupResult, {
          course: normalizeCourse(course),
          topic,
        }, "CanvasDiscussionTopicLookupResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "list_discussion_entries",
    {
      title: "List discussion entries",
      description: "List readable entries for a Canvas discussion topic.",
      inputSchema: {
        courseId: z.string(),
        topicId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId, topicId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const [topic, entries] = await Promise.all([
          client.getDiscussionTopic(String(course.id), topicId),
          client.getDiscussionEntries(String(course.id), topicId),
        ])

        return successResult(CanvasListDiscussionEntriesResult, {
          course: normalizeCourse(course),
          topic,
          entries,
        }, "CanvasListDiscussionEntriesResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_discussion_entry_details",
    {
      title: "Get discussion entry details",
      description: "Fetch details for a readable Canvas discussion entry.",
      inputSchema: {
        courseId: z.string(),
        topicId: z.string(),
        entryId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId, topicId, entryId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const [topic, view] = await Promise.all([
          client.getDiscussionTopic(String(course.id), topicId),
          client.getDiscussionView(String(course.id), topicId),
        ])
        const entries = mergeDiscussionEntries(view.view ?? [], view.new_entries ?? [])
        const entry = findDiscussionEntry(entries, entryId)
        if (!entry) {
          throw new Error(`Canvas discussion entry ${entryId} was not found.`)
        }

        return successResult(CanvasDiscussionEntryLookupResult, {
          course: normalizeCourse(course),
          topic,
          entry,
        }, "CanvasDiscussionEntryLookupResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_discussion_with_replies",
    {
      title: "Get discussion with replies",
      description: "Fetch a Canvas discussion topic with its visible replies.",
      inputSchema: {
        courseId: z.string(),
        topicId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId, topicId }) => {
      try {
        const client = getCanvasClient(deps)
        const course = await requireCourse(client, courseId)
        const [topic, view] = await Promise.all([
          client.getDiscussionTopic(String(course.id), topicId),
          client.getDiscussionView(String(course.id), topicId),
        ])

        return successResult(CanvasGetDiscussionWithRepliesResult, {
          course: normalizeCourse(course),
          topic,
          entries: mergeDiscussionEntries(view.view ?? [], view.new_entries ?? []),
        }, "CanvasGetDiscussionWithRepliesResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "list_conversations",
    {
      title: "List conversations",
      description: "List Canvas conversations visible to the student.",
      inputSchema: {
        scope: z.enum(["unread", "starred", "archived", "sent"]).optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ scope }) => {
      try {
        const client = getCanvasClient(deps)
        const conversations = await client.getConversations({ scope })
        return successResult(CanvasListConversationsResult, { conversations }, "CanvasListConversationsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_conversation_details",
    {
      title: "Get conversation details",
      description: "Fetch details for a Canvas conversation visible to the student.",
      inputSchema: {
        conversationId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ conversationId }) => {
      try {
        const client = getCanvasClient(deps)
        const conversation = await client.getConversation(conversationId)
        return successResult(CanvasConversationLookupResult, { conversation }, "CanvasConversationLookupResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "get_unread_count",
    {
      title: "Get unread conversation count",
      description: "Fetch the student's unread Canvas conversation count.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const client = getCanvasClient(deps)
        const unreadCount = await client.getUnreadConversationCount()
        return successResult(CanvasGetUnreadCountResult, { unreadCount }, "CanvasGetUnreadCountResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "search_canvas_tools",
    {
      title: "Search Canvas tools",
      description: "Discover the student-facing Canvas MCP tool surface.",
      inputSchema: {
        query: z.string().optional(),
        category: z.enum(["self", "shared_read", "student_action"]).optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ query, category }) => {
      try {
        const normalizedQuery = query?.trim().toLowerCase()
        const tools = canvasStudentReplacementToolInventory.filter((tool) => {
          if (category && tool.category !== category) {
            return false
          }

          if (!normalizedQuery) {
            return true
          }

          return tool.name.toLowerCase().includes(normalizedQuery)
            || tool.description.toLowerCase().includes(normalizedQuery)
        })

        return successResult(CanvasSearchCanvasToolsResult, { tools }, "CanvasSearchCanvasToolsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}

function registerStudentActionTools(server: McpServer, deps: CanvasToolDependencies): void {
  server.registerTool(
    "post_discussion_entry",
    {
      title: "Post discussion entry",
      description: "Post a new entry to a Canvas discussion when the student is allowed to participate.",
      inputSchema: {
        courseId: z.string(),
        topicId: z.string(),
        message: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    async ({ courseId, topicId, message }) => {
      try {
        const client = getCanvasClient(deps)
        await requireCourse(client, courseId)
        const entry = await client.postDiscussionEntry(decodeCourseId(courseId), topicId, message)
        return successResult(CanvasPostDiscussionEntryResult, {
          success: true,
          courseId,
          topicId,
          entry,
          message: "Posted discussion entry.",
        }, "CanvasPostDiscussionEntryResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "reply_to_discussion_entry",
    {
      title: "Reply to discussion entry",
      description: "Reply to a Canvas discussion entry when the student is allowed to participate.",
      inputSchema: {
        courseId: z.string(),
        topicId: z.string(),
        entryId: z.string(),
        message: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    async ({ courseId, topicId, entryId, message }) => {
      try {
        const client = getCanvasClient(deps)
        await requireCourse(client, courseId)
        const reply = await client.replyToDiscussionEntry(decodeCourseId(courseId), topicId, entryId, message)
        return successResult(CanvasReplyToDiscussionEntryResult, {
          success: true,
          courseId,
          topicId,
          entryId,
          reply,
          message: "Posted discussion reply.",
        }, "CanvasReplyToDiscussionEntryResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "mark_conversations_read",
    {
      title: "Mark conversations read",
      description: "Mark one or more Canvas conversations as read.",
      inputSchema: {
        conversationIds: z.array(z.string()).min(1),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    async ({ conversationIds }) => {
      try {
        const client = getCanvasClient(deps)
        await Promise.all(conversationIds.map((conversationId) => client.markConversationRead(conversationId)))
        return successResult(CanvasMarkConversationsReadResult, {
          success: true,
          conversationIds,
          markedCount: conversationIds.length,
          message: `Marked ${conversationIds.length} conversation(s) as read.`,
        }, "CanvasMarkConversationsReadResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    "download_course_file",
    {
      title: "Download course file",
      description: "Download a readable Canvas file into the active workspace or another allowed writable path.",
      inputSchema: {
        courseId: z.string(),
        fileId: z.string(),
        destinationPath: z.string().optional(),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    async ({ courseId, fileId, destinationPath }) => {
      try {
        const client = getCanvasClient(deps)
        const canvasCourseId = decodeCourseId(courseId)
        const course = await requireCourse(client, courseId)
        const file = await requireFile(client, course, fileId)
        if (!file.url) {
          throw new Error(`Canvas file ${fileId} does not expose a downloadable URL.`)
        }

        const filename = sanitizeFilename(file.filename || file.display_name)
        const savedPath = await resolveDownloadPath({
          courseId: canvasCourseId,
          filename,
          destinationPath,
          workspaceRoot: getWorkspaceRoot(deps),
          writableRoots: getWritableRoots(deps),
        })
        const existed = await pathExists(savedPath)
        const payload = await client.downloadAuthorizedFile(file.url)

        await mkdir(path.dirname(savedPath), { recursive: true })
        await writeFile(savedPath, Buffer.from(payload))

        return successResult(CanvasDownloadCourseFileResult, {
          success: true,
          courseId,
          fileId,
          filename,
          savedPath,
          overwritten: existed,
          size: file.size ?? undefined,
          message: `Downloaded ${filename}.`,
        }, "CanvasDownloadCourseFileResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}

async function buildCourseContentOverview(
  client: ReturnType<typeof getCanvasClient>,
  course: CanvasCourse,
) {
  const [pages, modules, frontPage] = await Promise.all([
    swallowPermission(() => client.getPages(String(course.id)), []),
    swallowPermission(() => client.getModules(String(course.id)), []),
    swallowPermission(() => client.getFrontPage(String(course.id)), undefined, { swallowNotFound: true }),
  ])

  let moduleItemCount = 0
  for (const module of modules) {
    const items = await swallowPermission(
      () => client.getModuleItems(String(course.id), String(module.id)),
      [],
    )
    moduleItemCount += items.length
  }

  return {
    course: normalizeCourse(course),
    pageCount: pages.length,
    moduleCount: modules.length,
    moduleItemCount,
    frontPage,
  }
}

async function buildCourseAssignments(
  client: ReturnType<typeof getCanvasClient>,
  course: CanvasCourse,
  includeCompleted?: boolean,
) {
  return sortCoursework(
    (await client.getAssignmentsWithSubmission(String(course.id)))
      .filter((assignment) => assignment.published !== false)
      .map((assignment) => normalizeAssignment(assignment, course, assignment.submission ?? undefined))
      .filter((item) => includeCompleted || !["submitted", "graded", "complete", "completed"].includes(item.submissionStatus ?? "")),
  )
}

async function buildCourseStructure(
  client: ReturnType<typeof getCanvasClient>,
  course: CanvasCourse,
) {
  const modules = await swallowPermission(() => client.getModules(String(course.id)), [])
  const structured = []

  for (const module of modules) {
    const items = await swallowPermission(
      () => client.getModuleItems(String(course.id), String(module.id)),
      [],
    )
    structured.push({ module, items })
  }

  return {
    course: normalizeCourse(course),
    modules: structured,
  }
}

function extractUpcomingEventAssignment(event: {
  assignment?: {
    id: number
    course_id: number
    name: string
    due_at?: string | null
    points_possible?: number | null
    html_url?: string | null
    updated_at?: string | null
  } | null
  id?: string | number | null
  course_id?: string | number | null
  name?: string | null
  due_at?: string | null
  points_possible?: number | null
  html_url?: string | null
  updated_at?: string | null
}): {
  id: number
  course_id: number
  name: string
  due_at?: string | null
  points_possible?: number | null
  html_url?: string | null
  updated_at?: string | null
} | null {
  if (event.assignment) {
    return event.assignment
  }

  const id = toCanvasNumber(event.id)
  const courseId = toCanvasNumber(event.course_id)
  if (id === null || courseId === null || !event.name) {
    return null
  }

  return {
    id,
    course_id: courseId,
    name: event.name,
    due_at: event.due_at ?? undefined,
    points_possible: event.points_possible ?? undefined,
    html_url: event.html_url ?? undefined,
    updated_at: event.updated_at ?? undefined,
  }
}

function resolveAssignmentReference(input: {
  courseId?: string | number
  assignmentId?: string | number
  assignmentUrl?: string
  assignment_url?: string
  url?: string
}): { courseId: string; assignmentId: string; baseUrl?: string } {
  const parsed = parseAssignmentUrl(
    input.assignmentUrl ?? input.assignment_url ?? input.url ?? stringifyValue(input.assignmentId),
  )
  const courseId = stringifyValue(input.courseId) ?? parsed?.courseId
  const assignmentId = parsed?.assignmentId ?? stringifyValue(input.assignmentId)

  if (!courseId || !assignmentId) {
    throw new Error("Provide either courseId + assignmentId or a full Canvas assignment URL.")
  }

  return {
    courseId,
    assignmentId,
    baseUrl: parsed?.baseUrl,
  }
}

function stringifyValue(value: string | number | undefined): string | undefined {
  if (typeof value === "number") {
    return String(value)
  }
  return value
}

function toCanvasNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

async function resolveAssignmentCourse(
  client: ReturnType<typeof getCanvasClient>,
  courseId: string,
): Promise<CanvasCourse> {
  const discoveredCourse = (await resolveCourses(client, courseId))[0]
  if (discoveredCourse) {
    return discoveredCourse
  }

  const canvasCourseId = decodeCourseId(courseId)
  const numericCourseId = Number(canvasCourseId)
  if (!Number.isFinite(numericCourseId)) {
    throw new Error(`Canvas course ${courseId} was not found.`)
  }

  return {
    id: numericCourseId,
    name: `Canvas Course ${canvasCourseId}`,
    course_code: `Canvas Course ${canvasCourseId}`,
  }
}

function parseAssignmentUrl(value?: string): { courseId: string; assignmentId: string; baseUrl: string } | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    const match = url.pathname.match(/\/courses\/([^/]+)\/assignments\/([^/]+)/)
    if (!match) {
      return null
    }

    return {
      courseId: match[1] ?? "",
      assignmentId: match[2] ?? "",
      baseUrl: url.origin,
    }
  } catch {
    return null
  }
}

async function requireModule(
  client: ReturnType<typeof getCanvasClient>,
  course: CanvasCourse,
  moduleId: string,
): Promise<CanvasModule> {
  const module = (await client.getModules(String(course.id))).find((candidate) => String(candidate.id) === moduleId)
  if (!module) {
    throw new Error(`Canvas module ${moduleId} was not found.`)
  }
  return module
}

async function requireFile(
  client: ReturnType<typeof getCanvasClient>,
  course: CanvasCourse,
  fileId: string,
): Promise<CanvasFile> {
  const file = (await client.getCourseFiles(String(course.id))).find((candidate) => String(candidate.id) === fileId)
  if (!file) {
    throw new Error(`Canvas file ${fileId} was not found.`)
  }
  return file
}

async function swallowPermission<T>(
  callback: () => Promise<T>,
  fallback: T,
  options?: { swallowNotFound?: boolean },
): Promise<T> {
  try {
    return await callback()
  } catch (error) {
    if (isPermissionError(error) || (options?.swallowNotFound && isNotFoundError(error))) {
      return fallback
    }
    throw error
  }
}

function mergeDiscussionEntries(
  primary: readonly CanvasDiscussionEntry[],
  secondary: readonly CanvasDiscussionEntry[],
): CanvasDiscussionEntry[] {
  const seen = new Set<string>()
  const merged: CanvasDiscussionEntry[] = []

  for (const entry of [...primary, ...secondary]) {
    const id = String(entry.id)
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    merged.push(entry)
  }

  return merged
}

function findDiscussionEntry(
  entries: CanvasDiscussionEntry[],
  entryId: string,
): CanvasDiscussionEntry | undefined {
  for (const entry of entries) {
    if (String(entry.id) === entryId) {
      return entry
    }
    const nested = findDiscussionEntry(entry.recent_replies ?? [], entryId)
    if (nested) {
      return nested
    }
  }
  return undefined
}

function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim()
  const base = trimmed.length > 0 ? trimmed : "canvas-file"
  return base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
}

async function resolveDownloadPath(options: {
  courseId: string
  filename: string
  destinationPath?: string
  workspaceRoot: string
  writableRoots: string[]
}): Promise<string> {
  const preferred = options.destinationPath
    ? resolveUserPath(options.destinationPath, options.workspaceRoot, options.filename)
    : path.resolve(options.workspaceRoot, "downloads", "canvas", options.courseId, options.filename)

  if (!isWithinAnyRoot(preferred, options.writableRoots)) {
    throw new Error("Destination path must stay inside the active workspace or another allowed writable root.")
  }

  return preferred
}

function resolveUserPath(destinationPath: string, workspaceRoot: string, filename: string): string {
  const candidate = path.isAbsolute(destinationPath)
    ? destinationPath
    : path.resolve(workspaceRoot, destinationPath)

  if (destinationPath.endsWith(path.sep) || destinationPath.endsWith("/")) {
    return path.resolve(candidate, filename)
  }

  return candidate
}

function isWithinAnyRoot(candidatePath: string, writableRoots: string[]): boolean {
  return writableRoots.some((root) => isWithinRoot(candidatePath, root))
}

function isWithinRoot(candidatePath: string, root: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(candidatePath)
  const relative = path.relative(resolvedRoot, resolvedCandidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await stat(candidatePath)
    return true
  } catch {
    return false
  }
}
