import { describe, expect, test } from "bun:test"
import { getThreadStartPolicy } from "../ai/CodexEventParser.js"

describe("getThreadStartPolicy", () => {
  test("keeps default threads in workspace-write sandbox without provider approvals", () => {
    expect(getThreadStartPolicy("default")).toEqual({
      approvalPolicy: "never",
      sandbox: "workspace-write",
    })
  })

  test("keeps full-access threads in danger-full-access sandbox without provider approvals", () => {
    expect(getThreadStartPolicy("full")).toEqual({
      approvalPolicy: "never",
      sandbox: "danger-full-access",
    })
  })
})
