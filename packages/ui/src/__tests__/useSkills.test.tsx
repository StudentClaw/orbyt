import { beforeEach, describe, expect, test, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

const skillMocks = vi.hoisted(() => ({
  waitForPrimaryWsRpcClient: vi.fn(),
}))

vi.mock("../rpc/appRuntime", () => ({
  waitForPrimaryWsRpcClient: skillMocks.waitForPrimaryWsRpcClient,
  getPrimaryWsRpcClient: vi.fn(),
}))

import { useSkills } from "../hooks/useAppRuntime"

type MockSkillsClient = {
  skills: {
    list: () => Promise<{
      skills: Array<{ id: string; name: string; description: string }>
    }>
  }
}

function SkillsProbe() {
  const skills = useSkills()
  return <div data-testid="skills-count">{skills.length}</div>
}

describe("useSkills", () => {
  beforeEach(() => {
    skillMocks.waitForPrimaryWsRpcClient.mockReset()
  })

  test("waits for runtime bootstrap before loading skills", async () => {
    let resolveClient: (client: MockSkillsClient) => void = () => {
      throw new Error("waitForPrimaryWsRpcClient was not invoked")
    }

    skillMocks.waitForPrimaryWsRpcClient.mockImplementation(() => new Promise((resolve) => {
      resolveClient = resolve
    }))

    render(<SkillsProbe />)

    expect(screen.getByTestId("skills-count").textContent).toBe("0")

    resolveClient({
      skills: {
        list: async () => ({
          skills: [{ id: "brainstorming", name: "brainstorming", description: "Design work" }],
        }),
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId("skills-count").textContent).toBe("1")
    })
  })
})
