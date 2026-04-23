import { describe, test, expect } from "bun:test"
import type { SkillId } from "@orbyt/contracts"
import { evaluateSkillPolicy, type PolicyInput } from "../SkillPolicyGate.js"
import type { ResolvedSkill } from "../SkillParser.js"

function makeSkill(overrides: Partial<ResolvedSkill>): ResolvedSkill {
  return {
    id: "plan-mode" as SkillId,
    name: "Plan Mode",
    description: "planner",
    path: "/tmp/plan-mode/SKILL.md",
    instructions: "body",
    contextKey: null,
    tier: "curated",
    version: "1.0.0",
    requestedCapabilities: [],
    forkedFrom: null,
    ...overrides,
  }
}

function input(overrides: Partial<PolicyInput>): PolicyInput {
  return {
    skill: makeSkill({}),
    grantedKeys: [],
    toolCall: { server: "canvas-mcp", toolName: "get_page_content" },
    ...overrides,
  }
}

describe("SkillPolicyGate.evaluateSkillPolicy - allow path", () => {
  test("allows when the tool's logical key is both requested by the skill and granted", () => {
    const result = evaluateSkillPolicy(
      input({
        skill: makeSkill({ tier: "custom", requestedCapabilities: ["canvas.shared.read"] }),
        grantedKeys: ["canvas.shared.read"],
        toolCall: { server: "canvas-mcp", toolName: "get_page_content" },
      }),
    )
    expect(result.decision).toBe("allow")
  })

  test("allows a curated skill to call read-only tools without an explicit grant (auto-grant for reads only)", () => {
    const result = evaluateSkillPolicy(
      input({
        skill: makeSkill({ tier: "curated", requestedCapabilities: ["canvas.shared.read"] }),
        grantedKeys: [],
        toolCall: { server: "canvas-mcp", toolName: "get_page_content" },
      }),
    )
    expect(result.decision).toBe("allow")
    expect(result.reason.toLowerCase()).toContain("curated")
  })
})

describe("SkillPolicyGate.evaluateSkillPolicy - deny path", () => {
  test("denies when the skill did not declare the capability in frontmatter, even if a grant exists", () => {
    const result = evaluateSkillPolicy(
      input({
        skill: makeSkill({ requestedCapabilities: ["canvas.self.read"] }),
        grantedKeys: ["canvas.shared.read"],
        toolCall: { server: "canvas-mcp", toolName: "get_page_content" },
      }),
    )
    expect(result.decision).toBe("deny")
    if (result.decision === "deny") {
      expect(result.missingCapabilities).toContain("canvas.shared.read")
    }
  })

  test("denies when the skill declared the capability but no grant is present (write capability, custom tier)", () => {
    const result = evaluateSkillPolicy(
      input({
        skill: makeSkill({ tier: "custom", requestedCapabilities: ["calendar.events.write"] }),
        grantedKeys: [],
        toolCall: { server: "apple-calendar-mcp", toolName: "createCalendarEvent" },
      }),
    )
    expect(result.decision).toBe("deny")
    if (result.decision === "deny") {
      expect(result.missingCapabilities).toEqual(["calendar.events.write"])
    }
  })

  test("never auto-grants calendar.events.write or canvas.student.write to curated skills", () => {
    const writeEvent = evaluateSkillPolicy(
      input({
        skill: makeSkill({ tier: "curated", requestedCapabilities: ["calendar.events.write"] }),
        grantedKeys: [],
        toolCall: { server: "apple-calendar-mcp", toolName: "createCalendarEvent" },
      }),
    )
    expect(writeEvent.decision).toBe("deny")

    const studentWrite = evaluateSkillPolicy(
      input({
        skill: makeSkill({ tier: "curated", requestedCapabilities: ["canvas.student.write"] }),
        grantedKeys: [],
        toolCall: { server: "canvas-mcp", toolName: "post_discussion_entry" },
      }),
    )
    expect(studentWrite.decision).toBe("deny")
  })

  test("denies unknown tools (no capability mapping) with a stable reason so logs are greppable", () => {
    const result = evaluateSkillPolicy(
      input({
        skill: makeSkill({ tier: "curated", requestedCapabilities: ["canvas.shared.read"] }),
        grantedKeys: [],
        toolCall: { server: "canvas-mcp", toolName: "tool_that_does_not_exist" },
      }),
    )
    expect(result.decision).toBe("deny")
    expect(result.reason).toContain("unknown")
  })
})
