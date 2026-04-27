import { describe, expect, test } from "bun:test"
import { Schema } from "@effect/schema"
import {
  OrchestrationTurn,
  SendTurnParams,
  TurnReferenceInput,
} from "./index.js"

describe("@orbyt/contracts TurnReferenceInput", () => {
  test("decodes a canonical canvas-assignment reference", () => {
    const decoded = Schema.decodeUnknownSync(TurnReferenceInput)({
      kind: "canvas-assignment",
      id: "canvas-course:42:assignment:12345",
      label: "Essay 3",
      url: "https://canvas.example.edu/courses/42/assignments/12345",
    })

    expect(decoded.kind).toBe("canvas-assignment")
    expect(decoded.id).toBe("canvas-course:42:assignment:12345")
    expect(decoded.label).toBe("Essay 3")
    expect(decoded.url).toBe("https://canvas.example.edu/courses/42/assignments/12345")
  })

  test("rejects an unknown reference kind", () => {
    expect(() =>
      Schema.decodeUnknownSync(TurnReferenceInput)({
        kind: "canvas-page",
        id: "x",
        label: "x",
        url: null,
      }),
    ).toThrow()
  })

  test("SendTurnParams accepts a references array", () => {
    const decoded = Schema.decodeUnknownSync(SendTurnParams)({
      threadId: "thread_1",
      content: "Review this",
      attachments: [],
      references: [
        {
          kind: "canvas-assignment",
          id: "canvas-course:42:assignment:12345",
          label: "Essay 3",
          url: "https://canvas.example.edu/courses/42/assignments/12345",
        },
      ],
    })

    expect(decoded.references?.[0]?.id).toBe("canvas-course:42:assignment:12345")
  })

  test("SendTurnParams omitting references stays valid", () => {
    const decoded = Schema.decodeUnknownSync(SendTurnParams)({
      threadId: "thread_1",
      content: "Hello",
      attachments: [],
    })

    expect(decoded.content).toBe("Hello")
  })

  test("OrchestrationTurn surfaces persisted references", () => {
    const turn = Schema.decodeUnknownSync(OrchestrationTurn)({
      id: "turn_1",
      threadId: "thread_1",
      input: "Review this",
      output: "",
      reasoning: "",
      status: "queued",
      startedAt: "2026-04-23T12:00:00.000Z",
      completedAt: null,
      skill: null,
      attachments: [],
      references: [
        {
          id: "ref_1",
          kind: "canvas-assignment",
          referenceId: "canvas-course:42:assignment:12345",
          label: "Essay 3",
          url: "https://canvas.example.edu/courses/42/assignments/12345",
        },
      ],
    })

    expect(turn.references[0]?.referenceId).toBe(
      "canvas-course:42:assignment:12345",
    )
  })
})
