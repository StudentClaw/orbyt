import {
  CanvasAnnouncement,
  CanvasApiError,
  CanvasAssignment,
  CanvasAuthError,
  CanvasCourse,
  CanvasDecodeError,
  CanvasEnrollment,
  CanvasModule,
  CanvasModuleItem,
  CanvasPage,
  CanvasPermissionError,
  CanvasRateLimitError,
  CanvasSubmission,
} from "@student-claw/contracts"
import { Schema } from "@effect/schema"
import type { CanvasPluginCredentials } from "./runtime.js"

type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type RequestOptions = {
  signal?: AbortSignal
}

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

  async getAssignments(courseId: string, options?: RequestOptions): Promise<CanvasAssignment[]> {
    return this.paginate(`/api/v1/courses/${courseId}/assignments`, CanvasAssignment, {}, options)
  }

  async getAssignment(courseId: string, assignmentId: string, options?: RequestOptions): Promise<CanvasAssignment> {
    return this.request(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, CanvasAssignment, {}, options)
  }

  async getModules(courseId: string, options?: RequestOptions): Promise<CanvasModule[]> {
    return this.paginate(`/api/v1/courses/${courseId}/modules`, CanvasModule, {}, options)
  }

  async getModuleItems(courseId: string, moduleId: string, options?: RequestOptions): Promise<CanvasModuleItem[]> {
    return this.paginate(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, CanvasModuleItem, {}, options)
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

  private async request<T>(
    path: string,
    schema: Schema.Schema<T>,
    query: Record<string, string | string[] | undefined>,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, query)
    const response = await this.fetchJson(url, options)
    const payload = await response.json()

    try {
      return Schema.decodeUnknownSync(schema)(payload)
    } catch {
      throw new CanvasDecodeError({
        message: `Canvas response for ${path} did not match the expected schema.`,
        resource: path,
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
      const response = await this.fetchJson(nextUrl, options)
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
        } catch {
          throw new CanvasDecodeError({
            message: `Canvas item in ${path} did not match the expected schema.`,
            resource: path,
            rawPayload: JSON.stringify(rawItem),
          })
        }
      }

      nextUrl = this.getNextUrl(response.headers.get("link"))
    }

    return items
  }

  private async fetchJson(url: string, options?: RequestOptions): Promise<Response> {
    const response = await this.#fetchImpl(url, {
      method: "GET",
      signal: options?.signal,
      headers: {
        Authorization: `Bearer ${this.#token}`,
        Accept: "application/json",
      },
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
}
