import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { ChapterOverlay, type ChapterAction } from "./ChapterOverlay"
import { WalkthroughOverlay } from "./WalkthroughOverlay"
import {
  DASHBOARD_TOUR_STEPS,
  type TourStep,
  type WalkthroughStep,
} from "./walkthrough-steps"

const PLAN_MY_WEEK_TEST_ID = "plan-my-week"
const PLAN_MY_WEEK_POLL_INTERVAL_MS = 80
const PLAN_MY_WEEK_POLL_TIMEOUT_MS = 4000

function clickPlanMyWeekWhenReady(): void {
  if (typeof document === "undefined") return
  const start = Date.now()
  const tick = (): void => {
    const btn = document.querySelector<HTMLButtonElement>(
      `[data-testid="${PLAN_MY_WEEK_TEST_ID}"]`,
    )
    if (btn) {
      btn.click()
      return
    }
    if (Date.now() - start > PLAN_MY_WEEK_POLL_TIMEOUT_MS) return
    window.setTimeout(tick, PLAN_MY_WEEK_POLL_INTERVAL_MS)
  }
  tick()
}

const PENDING_TOUR_KEY = "orbyt:pending-tour"
const TOUR_QUERY_PARAM = "tour"

function readPendingTourFlag(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (sessionStorage.getItem(PENDING_TOUR_KEY) === "1") return true
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams(window.location.search)
  return params.get(TOUR_QUERY_PARAM) === "1"
}

function clearPendingTourFlag(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(PENDING_TOUR_KEY)
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href)
  if (url.searchParams.get(TOUR_QUERY_PARAM)) {
    url.searchParams.delete(TOUR_QUERY_PARAM)
    window.history.replaceState(
      null,
      "",
      url.pathname + (url.search ? `?${url.searchParams}` : ""),
    )
  }
}

async function persistTourCompleted(): Promise<void> {
  try {
    await getPrimaryWsRpcClient().onboarding.setPreferences({
      dashboardTourCompletedAt: new Date().toISOString(),
    })
  } catch {
    /* tour completion is best-effort — never block the user */
  }
}

// A route matches the step if pathname is exactly the step route or a sub-route
// of it. The chat route auto-redirects from "/chat" to "/chat/<workspace>" once
// a workspace is available — we should treat that as still being on the step.
function pathMatchesStepRoute(pathname: string, stepRoute: string): boolean {
  if (pathname === stepRoute) return true
  if (stepRoute === "/") return pathname === "/"
  return pathname.startsWith(`${stepRoute}/`)
}

export function TourController() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const initRef = useRef(false)

  // One-shot initialization: pending flag = explicit user request to run the tour.
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    if (!readPendingTourFlag()) return
    clearPendingTourFlag()
    setActive(true)
    setStepIdx(0)
  }, [])

  const step: TourStep | undefined = active ? DASHBOARD_TOUR_STEPS[stepIdx] : undefined

  // Navigate to the route this step lives on. Allow sub-routes (e.g. ChatPage
  // auto-redirecting "/chat" → "/chat/<workspaceId>") to count as a match so we
  // don't fight its router with our own redirect.
  useEffect(() => {
    if (!step) return
    if (pathMatchesStepRoute(pathname, step.route)) return
    void navigate({ to: step.route })
  }, [navigate, pathname, step])

  const dismiss = useCallback(async () => {
    setActive(false)
    setStepIdx(0)
    await persistTourCompleted()
  }, [])

  const advance = useCallback(() => {
    setStepIdx((idx) => {
      if (idx >= DASHBOARD_TOUR_STEPS.length - 1) {
        void dismiss()
        return idx
      }
      return idx + 1
    })
  }, [dismiss])

  const goBack = useCallback(() => {
    setStepIdx((idx) => Math.max(0, idx - 1))
  }, [])

  const finishToDashboard = useCallback(() => {
    void (async () => {
      await dismiss()
      await navigate({ to: "/" })
    })()
  }, [dismiss, navigate])

  const finishToPlanWeek = useCallback(() => {
    void (async () => {
      await dismiss()
      await navigate({ to: "/" })
      clickPlanMyWeekWhenReady()
    })()
  }, [dismiss, navigate])

  const spotlightSteps: ReadonlyArray<WalkthroughStep> = useMemo(
    () =>
      DASHBOARD_TOUR_STEPS.filter((s): s is Extract<TourStep, { kind: "spotlight" }> => s.kind === "spotlight").map(
        (s) => ({
          targetTestId: s.targetTestId,
          title: s.title,
          description: s.description,
          placement: s.placement,
        }),
      ),
    [],
  )

  const spotlightIndex = useMemo(() => {
    if (!step || step.kind !== "spotlight") return 0
    return spotlightSteps.findIndex((s) => s.targetTestId === step.targetTestId)
  }, [spotlightSteps, step])

  if (!active || !step) return null

  if (step.kind === "chapter") {
    const stepLabel = `Orby · ${stepIdx + 1} / ${DASHBOARD_TOUR_STEPS.length}`
    const actions: ReadonlyArray<ChapterAction> = step.finale
      ? [
          {
            label: "Open dashboard",
            variant: "secondary",
            onClick: finishToDashboard,
            testId: "walkthrough-finale-dashboard",
          },
          {
            label: "Plan my week",
            variant: "primary",
            onClick: finishToPlanWeek,
            testId: "walkthrough-finale-plan",
          },
        ]
      : [
          {
            label: "Skip tour",
            variant: "secondary",
            onClick: () => void dismiss(),
            testId: "walkthrough-chapter-skip",
          },
          {
            label: "Begin",
            variant: "primary",
            onClick: advance,
            testId: "walkthrough-chapter-primary",
          },
        ]
    return (
      <ChapterOverlay
        title={step.title}
        subtitle={step.subtitle}
        stepLabel={stepLabel}
        actions={actions}
      />
    )
  }

  // Keep the WalkthroughOverlay mounted across step changes — its dark
  // backdrop covers any page repaint during route navigation, and it polls
  // for its target so the spotlight rect snaps in once the new anchor mounts.
  return (
    <WalkthroughOverlay
      steps={spotlightSteps}
      currentStep={spotlightIndex}
      onNext={advance}
      onBack={goBack}
      onDismiss={() => void dismiss()}
    />
  )
}
