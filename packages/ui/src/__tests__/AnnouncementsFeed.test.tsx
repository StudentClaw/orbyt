import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AnnouncementsFeed } from "../components/dashboard/AnnouncementsFeed"
import type { AnnouncementData } from "../components/dashboard/announcement-types"

function makeAnnouncement(
  id: string,
  overrides: Partial<AnnouncementData> = {},
): AnnouncementData {
  return {
    id,
    courseId: "c1",
    courseName: "CS 101",
    professor: "Dr. Martinez",
    title: `Announcement ${id}`,
    body: "Short body",
    postedAt: new Date().toISOString(),
    read: false,
    ...overrides,
  }
}

describe("AnnouncementsFeed", () => {
  test("shows 'No announcements' when empty", () => {
    render(<AnnouncementsFeed announcements={[]} />)
    expect(screen.getByTestId("no-announcements")).toBeDefined()
    expect(screen.getByText("No announcements")).toBeDefined()
  })

  test("renders announcement cards sorted by date (newest first)", () => {
    const announcements = [
      makeAnnouncement("old", { postedAt: "2026-04-01T00:00:00Z", title: "Old One" }),
      makeAnnouncement("new", { postedAt: "2026-04-09T00:00:00Z", title: "New One" }),
    ]

    render(<AnnouncementsFeed announcements={announcements} />)

    const feed = screen.getByTestId("announcements-feed")
    const cards = feed.children
    // First card should be the newest
    expect(cards[0].getAttribute("data-testid")).toBe("announcement-new")
    expect(cards[1].getAttribute("data-testid")).toBe("announcement-old")
  })

  test("truncates long body and shows 'Read more' toggle", async () => {
    const longBody = "A".repeat(200)
    const announcements = [
      makeAnnouncement("long", { body: longBody }),
    ]

    render(<AnnouncementsFeed announcements={announcements} />)

    expect(screen.getByText("Read more")).toBeDefined()

    await userEvent.click(screen.getByTestId("toggle-long"))
    expect(screen.getByText("Show less")).toBeDefined()
    expect(screen.getByText(longBody)).toBeDefined()
  })

  test("shows unread badge for unread announcements", () => {
    const announcements = [
      makeAnnouncement("unread", { read: false }),
      makeAnnouncement("read", { read: true }),
    ]

    render(<AnnouncementsFeed announcements={announcements} />)

    // Only the unread card should have a "New" badge
    const badges = screen.getAllByTestId("unread-badge")
    expect(badges).toHaveLength(1)
  })

  test("read announcements have reduced opacity", () => {
    const announcements = [makeAnnouncement("r", { read: true })]

    render(<AnnouncementsFeed announcements={announcements} />)

    const card = screen.getByTestId("announcement-r")
    expect(card.className).toContain("opacity-70")
  })
})
