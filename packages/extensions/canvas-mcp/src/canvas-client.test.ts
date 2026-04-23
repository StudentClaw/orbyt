import { describe, expect, test } from "bun:test"
import { CanvasAuthError, CanvasDecodeError, CanvasRateLimitError } from "@orbyt/contracts"
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

  test("requests enriched course data for student grade summaries", async () => {
    let requestedUrl = ""

    const client = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "token" },
      {
        fetchImpl: async (input) => {
          requestedUrl = String(input)
          return new Response(JSON.stringify([
            {
              id: 1,
              name: "Biology",
              course_code: "BIO101",
              enrollments: [
                {
                  id: 10,
                  course_id: 1,
                  user_id: 42,
                  type: "StudentEnrollment",
                  enrollment_state: "active",
                  has_grading_periods: true,
                  current_grading_period_title: "Spring Term",
                  current_grading_period_id: 7,
                  current_period_computed_current_score: 97.5,
                  current_period_computed_current_grade: "A",
                  computed_current_score: 97.5,
                  computed_current_grade: "A",
                },
              ],
            },
          ]), { status: 200 })
        },
      },
    )

    const courses = await client.getCoursesWithEnrollments()
    expect(courses[0]?.enrollments?.[0]?.computed_current_grade).toBe("A")
    expect(requestedUrl).toContain("/api/v1/users/self/courses")
    expect(requestedUrl).toContain("include%5B%5D=enrollments")
    expect(requestedUrl).toContain("include%5B%5D=total_scores")
    expect(requestedUrl).toContain("include%5B%5D=current_grading_period_scores")
  })

  test("accepts course enrollments that omit enrollment ids in student course listings", async () => {
    const client = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "token" },
      {
        fetchImpl: async () => new Response(JSON.stringify([
          {
            id: 18832,
            name: "C Programming - 31296",
            course_code: "CS 36",
            enrollments: [
              {
                type: "student",
                role: "StudentEnrollment",
                user_id: 60080000000279830,
                enrollment_state: "active",
                has_grading_periods: false,
                totals_for_all_grading_periods_option: false,
                computed_current_grade: null,
                computed_current_score: 103.07,
                computed_final_grade: null,
                computed_final_score: 90.64,
                current_period_computed_current_score: null,
                current_period_computed_final_score: null,
                current_period_computed_current_grade: null,
                current_period_computed_final_grade: null,
              },
            ],
          },
        ]), { status: 200 }),
      },
    )

    const courses = await client.getCoursesWithEnrollments()
    expect(courses[0]?.id).toBe(18832)
    expect(courses[0]?.enrollments?.[0]?.computed_current_score).toBe(103.07)
    expect(courses[0]?.enrollments?.[0]?.computed_final_score).toBe(90.64)
  })

  test("requests assignments with embedded submission data for student status flows", async () => {
    let requestedUrl = ""

    const client = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "token" },
      {
        fetchImpl: async (input) => {
          requestedUrl = String(input)
          return new Response(JSON.stringify([
            {
              id: 101,
              course_id: 1,
              name: "Problem Set 1",
              due_at: "2026-04-15T23:59:00Z",
              submission: {
                assignment_id: 101,
                course_id: 1,
                submitted_at: "2026-04-14T16:00:00Z",
                workflow_state: "submitted",
              },
            },
          ]), { status: 200 })
        },
      },
    )

    const assignments = await client.getAssignmentsWithSubmission("1")
    expect(assignments[0]?.submission?.workflow_state).toBe("submitted")
    expect(requestedUrl).toContain("/api/v1/courses/1/assignments")
    expect(requestedUrl).toContain("include%5B%5D=submission")
  })

  test("accepts assignment submissions that omit course_id but include cached due dates", async () => {
    const client = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "token" },
      {
        fetchImpl: async () => new Response(JSON.stringify({
          id: 522179,
          course_id: 18832,
          name: "Lab 14a - Linked List w/Functions",
          html_url: "https://canvas.example.edu/courses/18832/assignments/522179",
          submission: {
            assignment_id: 522179,
            workflow_state: "graded",
            cached_due_date: "2026-04-20T06:59:59Z",
          },
        }), { status: 200 }),
      },
    )

    const assignment = await client.getAssignmentWithSubmission("18832", "522179")
    expect(assignment.submission?.assignment_id).toBe(522179)
    expect(assignment.submission?.workflow_state).toBe("graded")
  })

  test("supports upcoming events, todo items, and peer reviews for student self tools", async () => {
    const responses = [
      new Response(JSON.stringify([
        {
          id: 501,
          type: "assignment",
          assignment: {
            id: 101,
            course_id: 1,
            name: "Problem Set 1",
            due_at: "2026-04-15T23:59:00Z",
          },
        },
      ]), { status: 200 }),
      new Response(JSON.stringify([
        {
          type: "grading",
          course_id: 1,
          title: "Review draft",
          assignment: {
            id: 202,
            course_id: 1,
            name: "Essay Draft",
            due_at: "2026-04-18T20:00:00Z",
          },
        },
      ]), { status: 200 }),
      new Response(JSON.stringify([
        {
          user_id: 88,
          assessor_id: 42,
          workflow_state: "assigned",
        },
      ]), { status: 200 }),
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

    const [events, todos, peerReviews] = await Promise.all([
      client.getUpcomingEvents(),
      client.getTodoItems(),
      client.getPeerReviews("1", "202"),
    ])

    expect(events[0]?.assignment?.name).toBe("Problem Set 1")
    expect(todos[0]?.assignment?.name).toBe("Essay Draft")
    expect(peerReviews[0]?.workflow_state).toBe("assigned")
  })

  test("accepts upcoming events that expose assignment fields at the top level", async () => {
    const client = new CanvasClient(
      { baseUrl: "https://canvas.example.edu", token: "token" },
      {
        fetchImpl: async () => new Response(JSON.stringify([
          {
            id: 522179,
            course_id: 18832,
            name: "Lab 14a - Linked List w/Functions",
            due_at: "2026-04-20T06:59:59Z",
            html_url: "https://canvas.example.edu/courses/18832/assignments/522179",
          },
        ]), { status: 200 }),
      },
    )

    const events = await client.getUpcomingEvents()
    expect(events[0]?.course_id).toBe(18832)
    expect(events[0]?.name).toBe("Lab 14a - Linked List w/Functions")
  })
})
