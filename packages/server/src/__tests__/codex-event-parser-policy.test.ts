import { describe, expect, test } from "bun:test"
import {
  buildPermissionApprovalReply,
  getThreadStartPolicy,
} from "../ai/CodexEventParser.js"

describe("getThreadStartPolicy", () => {
  // Permission system removed: every thread runs with full access regardless
  // of the supplied accessMode.
  test("returns danger-full-access for default threads", () => {
    expect(getThreadStartPolicy("default")).toEqual({
      approvalPolicy: "never",
      sandbox: "danger-full-access",
    })
  })

  test("returns danger-full-access for full-access threads", () => {
    expect(getThreadStartPolicy("full")).toEqual({
      approvalPolicy: "never",
      sandbox: "danger-full-access",
    })
  })
})

describe("buildPermissionApprovalReply", () => {
  test("echoes back requested permissions with scope: always", () => {
    expect(
      buildPermissionApprovalReply({
        threadId: "t1",
        turnId: "u1",
        permissions: { "canvas.list_courses": "allow" },
      }),
    ).toEqual({
      permissions: { "canvas.list_courses": "allow" },
      scope: "always",
    })
  })

  // Regression: Codex treats `permissions: {}` as a denial which surfaces to
  // the AI as `user rejected MCP tool call`. When the params don't carry an
  // actionable permissions map we fall back to a wildcard so the user's
  // approve choice actually means accept.
  test("falls back to wildcard when params has no permissions map", () => {
    expect(buildPermissionApprovalReply({})).toEqual({
      permissions: { "*": "always" },
      scope: "always",
    })
  })

  test("falls back to wildcard when params is null or non-record", () => {
    expect(buildPermissionApprovalReply(null)).toEqual({
      permissions: { "*": "always" },
      scope: "always",
    })
    expect(buildPermissionApprovalReply("nope")).toEqual({
      permissions: { "*": "always" },
      scope: "always",
    })
  })

  test("falls back to wildcard when permissions field is an array", () => {
    expect(
      buildPermissionApprovalReply({ permissions: ["canvas.list_courses"] }),
    ).toEqual({ permissions: { "*": "always" }, scope: "always" })
  })

  test("honours scope option for turn-scoped approvals", () => {
    expect(
      buildPermissionApprovalReply(
        { permissions: { "canvas.list_courses": "allow" } },
        { scope: "turn" },
      ),
    ).toEqual({
      permissions: { "canvas.list_courses": "allow" },
      scope: "turn",
    })
  })
})
