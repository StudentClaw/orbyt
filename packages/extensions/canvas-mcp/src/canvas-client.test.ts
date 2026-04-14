import { describe, expect, test } from "bun:test"
import { CanvasAuthError, CanvasDecodeError, CanvasRateLimitError } from "@student-claw/contracts"
import { CanvasClient } from "./canvas-client.js"

describe("CanvasClient", () => {
  test("paginates course results", async () => {
    const responses = [
      new Response(
        JSON.stringify([
          { id: 1, name: "Biology", course_code: "BIO101" },
        ]),
        {
          status: 200,
          headers: {
            link: '<https://canvas.example.edu/api/v1/users/self/courses?page=2>; rel="next"',
          },
        },
      ),
      new Response(
        JSON.stringify([
          { id: 2, name: "Chemistry", course_code: "CHEM101" },
        ]),
        { status: 200 },
      ),
    ]

    const client = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "token" },
      {
        fetchImpl: async () => {
          const response = responses.shift()
          if (!response) {
            throw new Error("No more responses configured.")
          }
          return response
        },
      },
    )

    const courses = await client.getCourses()
    expect(courses).toHaveLength(2)
    expect(courses[1]?.course_code).toBe("CHEM101")
  })

  test("maps auth and rate-limit failures to typed errors", async () => {
    const authClient = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "bad-token" },
      {
        fetchImpl: async () => new Response("{}", { status: 401 }),
      },
    )

    await expect(authClient.getCourses()).rejects.toBeInstanceOf(CanvasAuthError)

    const rateLimitedClient = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "token" },
      {
        fetchImpl: async () => new Response("{}", {
          status: 429,
          headers: { "retry-after": "45" },
        }),
      },
    )

    await expect(rateLimitedClient.getCourses()).rejects.toBeInstanceOf(CanvasRateLimitError)
  })

  test("accepts sparse course payloads that omit optional Canvas fields", async () => {
    const client = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "token" },
      {
        fetchImpl: async () => new Response(JSON.stringify([
          {
            id: 1,
            name: "Biology",
            course_code: null,
            term: null,
            teacher: null,
            teachers: null,
          },
        ]), { status: 200 }),
      },
    )

    const courses = await client.getCourses()
    expect(courses[0]?.course_code).toBeNull()
    expect(courses[0]?.teachers).toBeNull()
  })

  test("includes the schema failure path in decode errors", async () => {
    const client = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "token" },
      {
        fetchImpl: async () => new Response(JSON.stringify([
          { id: "bad-id", name: "Biology" },
        ]), { status: 200 }),
      },
    )

    await expect(client.getCourses()).rejects.toMatchObject({
      _tag: "CanvasDecodeError",
      resource: "/api/v1/users/self/courses",
    } satisfies Partial<CanvasDecodeError>)

    await expect(client.getCourses()).rejects.toThrow("[\"id\"]")
  })
})
