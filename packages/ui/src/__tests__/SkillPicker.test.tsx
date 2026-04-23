import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SkillPicker, type SkillPickerEntry } from "../components/chat/SkillPicker"

function makeEntry(overrides: Partial<SkillPickerEntry> = {}): SkillPickerEntry {
  return {
    id: "plan-mode",
    name: "Plan Mode",
    description: "Weekly planning",
    tier: "curated",
    requestedCapabilities: [],
    missingCapabilities: [],
    forkedFrom: null,
    ...overrides,
  }
}

describe("SkillPicker Phase 04 badges + needs-permission CTA", () => {
  test("renders a Curated badge for curated skills with no missing grants", () => {
    render(
      <SkillPicker skills={[makeEntry()]} filter="" onSelect={() => undefined} onManagePermissions={() => undefined} />,
    )
    expect(screen.getByText(/curated/i)).toBeDefined()
  })

  test("renders a Forked badge when forkedFrom is set on a custom skill", () => {
    render(
      <SkillPicker
        skills={[makeEntry({ id: "my-plan", tier: "custom", forkedFrom: "plan-mode@1.0.0" })]}
        filter=""
        onSelect={() => undefined}
        onManagePermissions={() => undefined}
      />,
    )
    expect(screen.getByText(/forked/i)).toBeDefined()
  })

  test("renders a Custom badge for custom skills with no forkedFrom", () => {
    render(
      <SkillPicker
        skills={[makeEntry({ id: "my-skill", tier: "custom" })]}
        filter=""
        onSelect={() => undefined}
        onManagePermissions={() => undefined}
      />,
    )
    expect(screen.getByText(/^custom$/i)).toBeDefined()
  })

  test("shows a 'Needs permission' CTA and calls onManagePermissions(skill) when clicked", () => {
    const onManagePermissions = vi.fn()
    render(
      <SkillPicker
        skills={[
          makeEntry({
            requestedCapabilities: ["calendar.events.write"],
            missingCapabilities: ["calendar.events.write"],
          }),
        ]}
        filter=""
        onSelect={() => undefined}
        onManagePermissions={onManagePermissions}
      />,
    )
    const cta = screen.getByRole("button", { name: /needs permission/i })
    fireEvent.click(cta)
    expect(onManagePermissions).toHaveBeenCalledTimes(1)
    expect(onManagePermissions.mock.calls[0][0].id).toBe("plan-mode")
  })

  test("exposes an actions overflow menu with Fork option that calls onFork(skill)", () => {
    const onFork = vi.fn()
    render(
      <SkillPicker
        skills={[makeEntry()]}
        filter=""
        onSelect={() => undefined}
        onFork={onFork}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /actions for plan mode/i }))
    fireEvent.click(screen.getByText(/fork into custom skill/i))
    expect(onFork).toHaveBeenCalledTimes(1)
    expect(onFork.mock.calls[0][0].id).toBe("plan-mode")
  })

  test("hides Edit skill option when the skill is not editable", () => {
    render(
      <SkillPicker
        skills={[makeEntry({ editable: false })]}
        filter=""
        onSelect={() => undefined}
        onEdit={() => undefined}
        onFork={() => undefined}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /actions for plan mode/i }))
    expect(screen.queryByText(/edit skill/i)).toBeNull()
  })

  test("shows Edit skill option and calls onEdit when the skill is editable", () => {
    const onEdit = vi.fn()
    render(
      <SkillPicker
        skills={[makeEntry({ id: "my-plan", tier: "custom", editable: true })]}
        filter=""
        onSelect={() => undefined}
        onEdit={onEdit}
        onFork={() => undefined}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /actions for plan mode/i }))
    fireEvent.click(screen.getByText(/edit skill/i))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit.mock.calls[0][0].id).toBe("my-plan")
  })
})
