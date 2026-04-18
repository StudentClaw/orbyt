import {
  CanvasAnnouncement,
  CanvasApiError,
  CanvasAssignment,
  CanvasAssignmentWithSubmission,
  CanvasAuthError,
  CanvasConversation,
  CanvasCourse,
  CanvasCourseWithEnrollments,
  CanvasDecodeError,
  CanvasDiscussionEntry,
  CanvasDiscussionTopic,
  CanvasDiscussionView,
  CanvasEnrollment,
  CanvasFile,
  CanvasModule,
  CanvasModuleItem,
  CanvasPage,
  CanvasPeerReview,
  CanvasPermissionError,
  CanvasRateLimitError,
  CanvasSubmission,
  CanvasTodoItem,
  CanvasUnreadCount,
  CanvasUpcomingEvent,
} from "@student-claw/contracts"
import { Schema } from "@effect/schema"
import type { CanvasPluginCredentials } from "./runtime.js"

type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type RequestOptions = {
  signal?: AbortSignal
}

type JsonBody = Record<string, string | number | boolean | null | undefined>

export class CanvasClient {
  readonly #baseUrl: string
  readonly #token: string
  readonly #fetchImpl: FetchImpl

  constructor(credentials: CanvasPluginCredentials, options?: { fetchImpl?: FetchImpl }) {
    this.#baseUrl = credentials.baseUrl.replace(/\/+$/, "")
    this.#token = credentials.token
    this.#fetchImpl = options?.fetchImpl ?? fetch
  }

  async getCourses(options?: RequestOptions): Promise<CanvasCourse[]> {
    return this.paginate("/api/v1/users/self/courses", CanvasCourse, {
      enrollment_state: "active",
      "include[]": ["teachers", "term"],
    }, options)
  }

  async getCoursesWithEnrollments(options?: RequestOptions): Promise<CanvasCourseWithEnrollments[]> {
    return this.paginate("/api/v1/users/self/courses", CanvasCourseWithEnrollments, {
      enrollment_state: "active",
      "include[]": ["teachers", "term", "enrollments", "total_scores", "current_grading_period_scores"],
    }, options)
  }

  async getAssignments(courseId: string, options?: RequestOptions): Promise<CanvasAssignment[]> {
    return this.paginate(`/api/v1/courses/${courseId}/assignments`, CanvasAssignment, {}, options)
  }

  async getAssignmentsWithSubmission(courseId: string, options?: RequestOptions): Promise<CanvasAssignmentWithSubmission[]> {
    return this.paginate(`/api/v1/courses/${courseId}/assignments`, CanvasAssignmentWithSubmission, {
      "include[]": "submission",
    }, options)
  }

  async getAssignment(courseId: string, assignmentId: string, options?: RequestOptions): Promise<CanvasAssignment> {
    return this.request(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, CanvasAssignment, {}, options)
  }

  async getAssignmentWithSubmission(courseId: string, assignmentId: string, options?: RequestOptions): Promise<CanvasAssignmentWithSubmission> {
    return this.request(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, CanvasAssignmentWithSubmission, {
      "include[]": "submission",
    }, options)
  }

  async getModules(courseId: string, options?: RequestOptions): Promise<CanvasModule[]> {
    return this.paginate(`/api/v1/courses/${courseId}/modules`, CanvasModule, {}, options)
  }

  async getModuleItems(courseId: string, moduleId: string, options?: RequestOptions): Promise<CanvasModuleItem[]> {
    return this.paginate(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, CanvasModuleItem, {}, options)
  }

  async getModuleItem(courseId: string, moduleId: string, itemId: string, options?: RequestOptions): Promise<CanvasModuleItem> {
    return this.request(`/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`, CanvasModuleItem, {}, options)
  }

  async getPages(courseId: string, options?: RequestOptions): Promise<CanvasPage[]> {
    return this.paginate(`/api/v1/courses/${courseId}/pages`, CanvasPage, {
      "include[]": "body",
    }, options)
  }

  async getPage(courseId: string, pageId: string, options?: RequestOptions): Promise<CanvasPage> {
    return this.request(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageId)}`, CanvasPage, {
      "include[]": "body",
    }, options)
  }

  async getFrontPage(courseId: string, options?: RequestOptions): Promise<CanvasPage> {
    return this.request(`/api/v1/courses/${courseId}/front_page`, CanvasPage, {
      "include[]": "body",
    }, options)
  }

  async getAnnouncements(courseId: string, options?: RequestOptions): Promise<CanvasAnnouncement[]> {
    return this.paginate("/api/v1/announcements", CanvasAnnouncement, {
      context_codes: `course_${courseId}`,
    }, options)
  }

  async getEnrollments(courseId: string, options?: RequestOptions): Promise<CanvasEnrollment[]> {
    return this.paginate(`/api/v1/courses/${courseId}/enrollments`, CanvasEnrollment, {
      user_id: "self",
    }, options)
  }

  async getSubmission(courseId: string, assignmentId: string, options?: RequestOptions): Promise<CanvasSubmission> {
    return this.request(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`,
      CanvasSubmission,
      {},
      options,
    )
  }

  async getUpcomingEvents(options?: RequestOptions): Promise<CanvasUpcomingEvent[]> {
    return this.paginate("/api/v1/users/self/upcoming_events", CanvasUpcomingEvent, {
      per_page: "100",
    }, options)
  }

  async getTodoItems(options?: RequestOptions): Promise<CanvasTodoItem[]> {
    return this.paginate("/api/v1/users/self/todo", CanvasTodoItem, {
      per_page: "100",
    }, options)
  }

  async getPeerReviews(courseId: string, assignmentId: string, options?: RequestOptions): Promise<CanvasPeerReview[]> {
    return this.paginate(`/api/v1/courses/${courseId}/assignments/${assignmentId}/peer_reviews`, CanvasPeerReview, {
      "include[]": "user",
    }, options)
  }

  async getCourseFiles(courseId: string, options?: RequestOptions): Promise<CanvasFile[]> {
    return this.paginate(`/api/v1/courses/${courseId}/files`, CanvasFile, {}, options)
  }

  async getDiscussionTopics(courseId: string, options?: RequestOptions): Promise<CanvasDiscussionTopic[]> {
    return this.paginate(`/api/v1/courses/${courseId}/discussion_topics`, CanvasDiscussionTopic, {}, options)
  }

  async getDiscussionTopic(courseId: string, topicId: string, options?: RequestOptions): Promise<CanvasDiscussionTopic> {
    return this.request(`/api/v1/courses/${courseId}/discussion_topics/${topicId}`, CanvasDiscussionTopic, {}, options)
  }

  async getDiscussionEntries(courseId: string, topicId: string, options?: RequestOptions): Promise<CanvasDiscussionEntry[]> {
    return this.paginate(`/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries`, CanvasDiscussionEntry, {}, options)
  }

  async getDiscussionView(courseId: string, topicId: string, options?: RequestOptions): Promise<CanvasDiscussionView> {
    return this.request(`/api/v1/courses/${courseId}/discussion_topics/${topicId}/view`, CanvasDiscussionView, {
      include_new_entries: "1",
    }, options)
  }

  async postDiscussionEntry(courseId: string, topicId: string, message: string, options?: RequestOptions): Promise<CanvasDiscussionEntry> {
    return this.requestWithBody(
      "POST",
      `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries`,
      CanvasDiscussionEntry,
      {
        message,
      },
      options,
    )
  }

  async replyToDiscussionEntry(
    courseId: string,
    topicId: string,
    entryId: string,
    message: string,
    options?: RequestOptions,
  ): Promise<CanvasDiscussionEntry> {
    return this.requestWithBody(
      "POST",
      `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries/${entryId}/replies`,
      CanvasDiscussionEntry,
      {
        message,
      },
      options,
    )
  }

  async getConversations(
    params?: { scope?: "unread" | "starred" | "archived" | "sent" },
    options?: RequestOptions,
  ): Promise<CanvasConversation[]> {
    return this.paginate("/api/v1/conversations", CanvasConversation, {
      scope: params?.scope,
    }, options)
  }

  async getConversation(conversationId: string, options?: RequestOptions): Promise<CanvasConversation> {
    return this.request(`/api/v1/conversations/${conversationId}`, CanvasConversation, {}, options)
  }

  async getUnreadConversationCount(options?: RequestOptions): Promise<number> {
    const payload = await this.request("/api/v1/conversations/unread_count", CanvasUnreadCount, {}, options) as {
      unread_count: string | number
    }
    const value = typeof payload.unread_count === "string" ? Number(payload.unread_count) : payload.unread_count
    return Number.isFinite(value) ? value : 0
  }

  async markConversationRead(conversationId: string, options?: RequestOptions): Promise<void> {
    await this.requestWithoutResponseBody("PUT", `/api/v1/conversations/${conversationId}`, {
      "conversation[workflow_state]": "read",
    }, options)
  }

  async downloadAuthorizedFile(url: string, options?: RequestOptions): Promise<ArrayBuffer> {
    const response = await this.fetchResponse(url, { method: "GET", signal: options?.signal })
    return response.arrayBuffer()
  }

  private async request<T>(
    path: string,
    schema: Schema.Schema<T>,
    query: Record<string, string | string[] | undefined>,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, query)
    return this.decodeResponse(url, schema, { method: "GET", signal: options?.signal })
  }

  private async requestWithBody<T>(
    method: "POST" | "PUT",
    path: string,
    schema: Schema.Schema<T>,
    body: JsonBody,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, {})
    return this.decodeResponse(url, schema, {
      method,
      body: this.toFormData(body),
      signal: options?.signal,
    })
  }

  private async requestWithoutResponseBody(
    method: "POST" | "PUT",
    path: string,
    body: JsonBody,
    options?: RequestOptions,
  ): Promise<void> {
    const url = this.buildUrl(path, {})
    await this.fetchResponse(url, {
      method,
      body: this.toFormData(body),
      signal: options?.signal,
    })
  }

  private async decodeResponse<T>(
    url: string,
    schema: Schema.Schema<T>,
    init: RequestInit,
  ): Promise<T> {
    const response = await this.fetchResponse(url, init)
    const payload = await response.json()

    try {
      return Schema.decodeUnknownSync(schema)(payload)
    } catch (error) {
      throw new CanvasDecodeError({
        message: this.formatDecodeError(`Canvas response for ${url} did not match the expected schema.`, error),
        resource: url,
        rawPayload: JSON.stringify(payload),
      })
    }
  }

  private async paginate<T>(
    path: string,
    schema: Schema.Schema<T>,
    query: Record<string, string | string[] | undefined>,
    options?: RequestOptions,
  ): Promise<T[]> {
    const items: T[] = []
    let nextUrl: string | null = this.buildUrl(path, query)

    while (nextUrl) {
      const response = await this.fetchResponse(nextUrl, { method: "GET", signal: options?.signal })
      const payload = await response.json()

      if (!Array.isArray(payload)) {
        throw new CanvasDecodeError({
          message: `Canvas response for ${path} was expected to be an array.`,
          resource: path,
          rawPayload: JSON.stringify(payload),
        })
      }

      for (const rawItem of payload) {
        try {
          items.push(Schema.decodeUnknownSync(schema)(rawItem))
        } catch (error) {
          throw new CanvasDecodeError({
            message: this.formatDecodeError(`Canvas item in ${path} did not match the expected schema.`, error),
            resource: path,
            rawPayload: JSON.stringify(rawItem),
          })
        }
      }

      nextUrl = this.getNextUrl(response.headers.get("link"))
    }

    return items
  }

  private async fetchResponse(url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${this.#token}`)
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json")
    }

    const response = await this.#fetchImpl(url, {
      ...init,
      headers,
    })

    if (response.status === 401) {
      throw new CanvasAuthError({
        message: "Canvas rejected the access token.",
        statusCode: response.status,
        endpoint: url,
      })
    }

    if (response.status === 403) {
      throw new CanvasPermissionError({
        message: "Canvas denied access to the requested resource.",
        endpoint: url,
      })
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after")
      throw new CanvasRateLimitError({
        message: "Canvas rate limited the request.",
        retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
        endpoint: url,
      })
    }

    if (!response.ok) {
      throw new CanvasApiError({
        message: `Canvas request failed for ${url}.`,
        statusCode: response.status,
        endpoint: url,
        retryAfterSeconds: response.headers.get("retry-after")
          ? Number(response.headers.get("retry-after"))
          : undefined,
      })
    }

    return response
  }

  private buildUrl(path: string, query: Record<string, string | string[] | undefined>): string {
    const url = new URL(path, this.#baseUrl)
    for (const [key, rawValue] of Object.entries(query)) {
      if (rawValue === undefined) {
        continue
      }
      if (Array.isArray(rawValue)) {
        for (const value of rawValue) {
          url.searchParams.append(key, value)
        }
        continue
      }
      url.searchParams.append(key, rawValue)
    }
    return url.toString()
  }

  private getNextUrl(linkHeader: string | null): string | null {
    if (!linkHeader) {
      return null
    }

    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
    return match?.[1] ?? null
  }

  private formatDecodeError(prefix: string, error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return `${prefix} ${error.message}`
    }
    return prefix
  }

  private toFormData(body: JsonBody): URLSearchParams {
    const form = new URLSearchParams()
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null) {
        continue
      }
      form.append(key, String(value))
    }
    return form
  }
}
