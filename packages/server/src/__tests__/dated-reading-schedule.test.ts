import { describe, expect, test } from "bun:test"
import type { Course } from "@orbyt/contracts"
import { parseDatedReadingSchedule } from "../canvas/dated-reading-schedule.js"

const MYTHOLOGY_SCHEDULE = `
Week 1: January 12-18

Monday, Jan. 12

First Day; No Assignment

Wednesday, Jan. 14

Read: Chapter 1: What is Myth?

Read: Chapter 2: Ways of Understanding Myth

Week 2: January 19-25

(Monday, January 19, NO CLASS MLK Holiday)

Wednesday, Jan. 21

Read: Myths of Creation (3) Greece

Week 6: February 16-22

(February 16 Presidents' Day NO CLASS)

Wednesday, Feb. 18

Quiz 1 Myths of Creation and Destruction

You can use your Handwritten Notes
No Books, No Devices, No Screens
Bring a Large Green Book and Two Pens (in blue or black ink).
`

describe("dated reading schedule parser", () => {
  test("turns mythology readings and quizzes into page-sourced coursework", () => {
    const course: Course = {
      id: "canvas-course:19737" as Course["id"],
      name: "Mythology",
      code: "MYTH",
      canvasId: "19737",
      term: "Spring 2026",
    }

    const items = parseDatedReadingSchedule({
      body: MYTHOLOGY_SCHEDULE,
      course,
      sourceId: "assignment-source:mythology-wiki",
      sourceUrl: "https://ivc-new.instructure.com/courses/19737/wiki",
      now: new Date("2026-04-24T12:00:00.000Z"),
    })

    expect(items.map((item) => ({
      title: item.title,
      due: item.effectiveDueAt,
      sourceType: item.sourceType,
      sourceDueDateKind: item.sourceDueDateKind,
    }))).toEqual([
      {
        title: "Read: Chapter 1: What is Myth?",
        due: "2026-01-14T23:59:00.000Z",
        sourceType: "page",
        sourceDueDateKind: "inferred",
      },
      {
        title: "Read: Chapter 2: Ways of Understanding Myth",
        due: "2026-01-14T23:59:00.000Z",
        sourceType: "page",
        sourceDueDateKind: "inferred",
      },
      {
        title: "Read: Myths of Creation (3) Greece",
        due: "2026-01-21T23:59:00.000Z",
        sourceType: "page",
        sourceDueDateKind: "inferred",
      },
      {
        title: "Quiz 1 Myths of Creation and Destruction",
        due: "2026-02-18T23:59:00.000Z",
        sourceType: "page",
        sourceDueDateKind: "inferred",
      },
    ])
    expect(items.every((item) => item.htmlUrl === "https://ivc-new.instructure.com/courses/19737/wiki")).toBe(true)
  })
})
