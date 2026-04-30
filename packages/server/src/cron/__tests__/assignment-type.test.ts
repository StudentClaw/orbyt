import { describe, test, expect } from "bun:test"
import { classifyAssignmentByTitle, ASSIGNMENT_TYPES } from "../assignment-type.js"

describe("classifyAssignmentByTitle", () => {
  const cases: Array<{ title: string; expected: typeof ASSIGNMENT_TYPES[number] }> = [
    // assessments — must hit even with surrounding text
    { title: "Calc Midterm", expected: "assessment" },
    { title: "Quiz 4: Stoichiometry", expected: "assessment" },
    { title: "Final exam", expected: "assessment" },
    { title: "CS101 Test 2", expected: "assessment" },
    { title: "Practical exam", expected: "assessment" },
    { title: "Oral presentation defense", expected: "assessment" },
    { title: "Pop quiz on chap 3", expected: "assessment" },
    { title: "Midterm review session", expected: "assessment" },

    // work — homework/lab/project/etc
    { title: "Lab 4: Buffers", expected: "work" },
    { title: "HW 7", expected: "work" },
    { title: "Homework 12", expected: "work" },
    { title: "Problem set 3", expected: "work" },
    { title: "PSET 5", expected: "work" },
    { title: "Final Project Proposal", expected: "work" },
    { title: "Lab report: titration", expected: "work" },
    { title: "Term paper: Aristotle", expected: "work" },
    { title: "Essay #2", expected: "work" },
    { title: "Writeup for experiment 4", expected: "work" },
    { title: "Group assignment", expected: "work" },
    { title: "Submission 1", expected: "work" },

    // passive
    { title: "Pre-reading: Chapter 3", expected: "passive" },
    { title: "Pre reading for week 5", expected: "passive" },
    { title: "Reading: Plato Republic", expected: "passive" },
    { title: "Discussion post: Ethics", expected: "passive" },
    { title: "Forum post #2", expected: "passive" },
    { title: "Reflection on lecture 3", expected: "passive" },
    { title: "Response paper to article", expected: "work" }, // 'paper' wins
    { title: "Read chapter 4", expected: "passive" },
    { title: "Comment on classmates' posts", expected: "passive" },

    // assessment beats work when both present
    { title: "Quiz worksheet", expected: "assessment" },
    { title: "Lab quiz", expected: "assessment" },

    // default
    { title: "Module deliverable", expected: "work" },
    { title: "", expected: "work" },
    { title: "Untitled", expected: "work" },
  ]

  for (const c of cases) {
    test(`"${c.title}" → ${c.expected}`, () => {
      expect(classifyAssignmentByTitle(c.title)).toBe(c.expected)
    })
  }

  test("case-insensitive matching", () => {
    expect(classifyAssignmentByTitle("FINAL EXAM")).toBe("assessment")
    expect(classifyAssignmentByTitle("homework 1")).toBe("work")
    expect(classifyAssignmentByTitle("READING")).toBe("passive")
  })
})
