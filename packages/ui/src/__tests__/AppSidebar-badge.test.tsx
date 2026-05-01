import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const hookMocks = vi.hoisted(() => ({
  unreadCount: 0,
  pathname: "/",
  open: true,
  openMobile: false,
  isMobile: false,
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => ({
    location: { pathname: hookMocks.pathname },
  }),
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeActivityUnreadCount: () => hookMocks.unreadCount,
}))

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <nav data-testid="sidebar">{children}</nav>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuBadge: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode; asChild?: boolean; isActive?: boolean }) => <>{children}</>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  SidebarTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  useSidebar: () => ({
    isMobile: hookMocks.isMobile,
    open: hookMocks.open,
    openMobile: hookMocks.openMobile,
  }),
  SidebarSeparator: () => <hr />,
}))

vi.mock("@/components/shell/ChatHistory", () => ({
  ChatHistory: () => <div data-testid="chat-history" />,
}))

import { AppSidebar } from "../components/shell/AppSidebar"

describe("AppSidebar activity badge", () => {
  beforeEach(() => {
    hookMocks.unreadCount = 0
    hookMocks.pathname = "/"
    hookMocks.open = true
    hookMocks.openMobile = false
    hookMocks.isMobile = false
  })

  test("does not show badge when unread count is 0", () => {
    hookMocks.unreadCount = 0
    render(<AppSidebar />)
    expect(screen.queryByTestId("activity-badge")).toBeNull()
  })

  test("shows badge with count when unread count > 0", () => {
    hookMocks.unreadCount = 5
    render(<AppSidebar />)
    const badge = screen.getByTestId("activity-badge")
    expect(badge).toBeDefined()
    expect(badge.textContent).toBe("5")
  })

  test("shows 99+ when unread count exceeds 99", () => {
    hookMocks.unreadCount = 150
    render(<AppSidebar />)
    const badge = screen.getByTestId("activity-badge")
    expect(badge.textContent).toBe("99+")
  })

  test("shows exact count at 99", () => {
    hookMocks.unreadCount = 99
    render(<AppSidebar />)
    const badge = screen.getByTestId("activity-badge")
    expect(badge.textContent).toBe("99")
  })

  test("renders the embedded chat history section", () => {
    render(<AppSidebar />)
    expect(screen.getByTestId("chat-history")).toBeDefined()
  })

  test("renders the updated Orybt brand label", () => {
    render(<AppSidebar />)
    expect(screen.getByText("Orybt")).toBeDefined()
    expect(screen.getByTestId("sidebar-brand-icon")).toBeDefined()
    expect(screen.queryByText("Orbyt")).toBeNull()
  })

  test("keeps the logo visible when the desktop sidebar is collapsed", () => {
    hookMocks.open = false
    render(<AppSidebar />)

    expect(screen.getByTestId("sidebar-brand-icon")).toBeDefined()
    expect(screen.queryByText("Orybt")).toBeNull()
  })

  test("keeps settings available when the desktop sidebar is collapsed", () => {
    hookMocks.open = false
    render(<AppSidebar />)

    expect(screen.getByTestId("sidebar-settings-link")).toBeDefined()
    expect(screen.getByTestId("sidebar-plugins-link")).toBeDefined()
    expect(screen.getByLabelText("Settings")).toBeDefined()
  })

  test("does not render a chat nav entry", () => {
    render(<AppSidebar />)
    expect(screen.queryByText("Chat")).toBeNull()
  })

  test("renders settings as a footer icon control", () => {
    render(<AppSidebar />)
    expect(screen.getByTestId("sidebar-settings-link")).toBeDefined()
    expect(screen.getByLabelText("Settings")).toBeDefined()
  })

  test("renders plugins as a main sidebar link", () => {
    render(<AppSidebar />)
    expect(screen.getByTestId("sidebar-plugins-link").getAttribute("href")).toBe("/plugins")
    expect(screen.getByText("Plugins")).toBeDefined()
  })
})
