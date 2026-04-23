# Orbyt UI Screen Map (v1)

Lightweight inventory of v1 UI/UX surfaces based on `docs/features`.

## Scope

- v1 only (no deferred/v2 surfaces).
- Desktop-first (target 1280px+), responsive degradation only.
- Focused on screen/view-level tracking, not component-level implementation details.

## Layout Baseline (shadcn-first)

- App shell: persistent left rail + primary content pane + optional right slide-over panel.
- Structure primitives: `Sidebar`, `Tabs`, `Card`, `Separator`, `ScrollArea`, `Sheet`.
- Data display: `Table`, `Badge`, `Progress`, `Calendar`, chart container wrappers.
- Input and flow controls: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Dialog`, `Popover`, `Tooltip`.
- Feedback/status: `Alert`, `Toast`, `Skeleton`, `Banner` (custom wrapper over `Alert`).

## Screen Inventory


| Area       | Screen / View                               | Purpose                                                                  | Layout Notes (shadcn-oriented)                                                     | Key States                                                       |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| App Shell  | Main App Frame                              | Persistent navigation and context container for all primary views        | Left rail + top context bar + main content region; optional right `Sheet` for chat | Connected, offline-cache mode, stale-data warning                |
| Onboarding | Welcome Step                                | Set expectations, privacy, and time-to-complete framing                  | Single-column centered content with strong CTA and short checklist                 | First run, resumed run                                           |
| Onboarding | Canvas Connection Step                      | Collect institution URL + Canvas token and validate connection           | Split layout: instruction panel + credential form; inline validation feedback      | Validating, success, invalid token, invalid URL, expired token   |
| Onboarding | AI Authentication Step                      | Gate entry with required ChatGPT OAuth flow                              | Auth status card + launch-auth CTA + retry path                                    | Not authenticated, in-progress, success, failure                 |
| Onboarding | Preferences Step                            | Collect study preferences and notification baseline                      | Form-heavy step with grouped cards and toggles                                     | Initial input, validation errors, saved                          |
| Onboarding | Routines Step                               | Collect weekly recurring commitments                                     | Weekly grid editor with block input + preview                                      | Empty schedule, populated schedule, edit mode                    |
| Onboarding | First Sync Step                             | Show import progress and first data hydration                            | Streaming progress list + summary card                                             | Running, partial retry, success                                  |
| Onboarding | Extension Recommendations Step              | Suggest plugin installs from detected needs                              | Recommendation cards with install actions and skip option                          | None recommended, recommended available, install success/failure |
| Onboarding | Dashboard Walkthrough                       | Guided intro of populated dashboard with live AI narration               | Tooltip overlays + progressive spotlight + contextual chat entry                   | Active tour, skipped section, completed                          |
| Onboarding | Semester Prompt (Lightweight Re-onboarding) | Quick per-term update for routines/priorities                            | Single-screen prompt with short editable sections                                  | New term detected, dismissed, completed                          |
| Dashboard  | Dashboard Home                              | Unified command center for priorities, planning, progress, and awareness | Section stack in fixed order; dense but glanceable cards and strips                | Fresh data, stale banner, partial data                           |
| Dashboard  | Priority Queue                              | Rank top work items and what to do next                                  | Top-dominant card list with urgency badges and countdown chips                     | Top list stable, top list changed, empty                         |
| Dashboard  | Insight Cards Strip                         | Surface AI-generated proactive insights                                  | Horizontal `ScrollArea` with action cards below priority queue                     | No insights, weekly insights, event-driven insights              |
| Dashboard  | Upcoming Deadlines Timeline                 | Show next 14 days of due items                                           | Timeline strip with expandable day popovers                                        | Low density, high density (+N more), no deadlines                |
| Dashboard  | Weekly Calendar View                        | Show scheduled study sessions and conflicts                              | Week grid with color-coded course blocks and markers                               | Normal, overlapping conflict, unresolved sessions                |
| Dashboard  | Grade Overview                              | Show current grades, trend, and GPA projection                           | Course cards + line chart + projection panel                                       | Stable trends, up/down trends, missing credit hours disclaimer   |
| Dashboard  | Weekly Progress                             | Show completed work vs plan and streak health                            | Progress indicators + week-over-week comparison                                    | On track, behind, streak active/reset                            |
| Dashboard  | Announcements Feed                          | Course announcement stream with read state and summary affordance        | Feed list cards with expand, attachment chip, action buttons                       | Unread/read, summary generated/cached, empty                     |
| Dashboard  | Completion Check-in Prompt                  | Capture session outcome (Yes/No/Yes-but)                                 | Lightweight modal/panel prompt with three primary outcomes                         | Prompted from notification, dismissed, submitted                 |
| Dashboard  | Quick Actions Row                           | Launch contextual chat flows quickly                                     | Compact action buttons/chips, opens right-side chat `Sheet`                        | Idle, launching, unavailable (AI/auth issue)                     |
| Chat       | Chat Slide-over Panel                       | Keep dashboard context visible while interacting with AI                 | Right `Sheet` over dashboard; message stream + composer + skill indicators         | Streaming, interrupted, queued offline                           |
| Activity   | Unified Activity Center                     | Durable feed across Canvas, Planner, Agent Activity, Insights            | Filter tabs + feed list + badges + deep-link actions                               | Empty, filtered results, unread, failed workflows                |
| Files      | File Explorer                               | Course-oriented local file browsing with tags and trash access           | Split pane: tree/list + viewer region                                              | Empty library, filtered view, soft-deleted items                 |
| Files      | Markdown Viewer / Editor                    | Read/edit markdown notes and generated study docs                        | View/edit toggle, rich markdown render and editor panes                            | View mode, edit mode, unsaved changes                            |
| Files      | PDF Viewer                                  | Read assignment sheets and papers inline                                 | Toolbar + page canvas + thumbnails/search                                          | Loading, searchable, text-selected                               |
| Files      | Generic File Viewers                        | Handle images, code, text, docx (best effort)                            | Type-based renderer in shared viewer container                                     | Supported inline, fallback external open                         |
| Skills     | Skill Selector in Chat                      | Activate/deactivate curated/custom skills and show active state          | Compact selector/dropdown + active badges                                          | No skill, single active, multi-active conflict handling          |
| Skills     | Skill Editor                                | Create/edit custom markdown skills with frontmatter validation           | Editor workspace with validation panel and permission hints                        | Draft, invalid frontmatter, saved                                |
| Skills     | Skill Promotion Dialog                      | Approve elevated capabilities for custom skills                          | Review dialog with per-capability decisions                                        | Pending review, approved, denied                                 |
| Plugins    | Plugins Manager Tab                         | Manage installed plugins, status, auth, and retries                      | Plugin list cards + status badges + actions                                        | Discovered, starting, ready, error                               |
| Settings   | Onboarding Step Re-entry                    | Re-run selected onboarding steps post-setup                              | Settings sections linking to individual setup flows                                | Completed state, needs revalidation                              |
| Settings   | Notifications Preferences                   | Per-type notification toggles and quiet hours                            | Toggle groups + quiet-hours time controls                                          | Enabled/disabled per type, quiet-hours active                    |
| Settings   | Semester Archive Access                     | Access past semester data from dashboard era transitions                 | Settings link or archive view entry point                                          | Current semester only, archive available                         |


## Notes

- Fixed dashboard section order in v1 (no drag/rearrange customization).
- Mobile dashboard replication is out of scope for v1; notifications may exist on phone.
- Deep links referenced by notifications should resolve into existing views/routes in this map (`/dashboard`, `/planner/calendar`, `/activity`, assignment/course detail contexts).