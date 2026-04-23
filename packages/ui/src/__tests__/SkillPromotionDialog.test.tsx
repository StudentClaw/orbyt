import { describe, test, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SkillPromotionDialog } from "../components/skills/SkillPromotionDialog"

describe("SkillPromotionDialog", () => {
  test("lists each requested capability with plain-language description and toggles ungranted ones", async () => {
    const onGrant = vi.fn().mockResolvedValue(undefined)
    const onRevoke = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <SkillPromotionDialog
        open
        skill={{
          id: "study-helper",
          name: "Study Helper",
          tier: "curated",
          requestedCapabilities: ["canvas.shared.read", "canvas.self.read"],
          grantedCapabilities: ["canvas.shared.read"],
        }}
        onGrant={onGrant}
        onRevoke={onRevoke}
        onOpenChange={() => undefined}
      />,
    )

    expect(screen.getAllByRole("switch").length).toBe(2)
    expect(screen.getByText(/read your canvas data/i)).toBeDefined()

    const switches = screen.getAllByRole("switch") as HTMLButtonElement[]
    await user.click(switches[1]!)

    await waitFor(() => expect(onGrant).toHaveBeenCalledTimes(1))
    expect(onGrant).toHaveBeenCalledWith({
      skillId: "study-helper",
      capabilityKey: "canvas.self.read",
    })
  })

  test("shows a high-risk warning for calendar.events.write and gates confirm with a checkbox", async () => {
    const onGrant = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <SkillPromotionDialog
        open
        skill={{
          id: "plan-mode",
          name: "Plan Mode",
          tier: "curated",
          requestedCapabilities: ["calendar.events.write"],
          grantedCapabilities: [],
        }}
        onGrant={onGrant}
        onRevoke={() => Promise.resolve()}
        onOpenChange={() => undefined}
      />,
    )

    expect(screen.getByText(/high-risk/i)).toBeDefined()

    const capabilitySwitch = screen.getAllByRole("switch")[0]!
    await user.click(capabilitySwitch)
    expect(onGrant).not.toHaveBeenCalled()

    const ack = screen.getByRole("checkbox", { name: /i understand/i })
    await user.click(ack)
    await user.click(capabilitySwitch)
    await waitFor(() => expect(onGrant).toHaveBeenCalledTimes(1))
  })
})
