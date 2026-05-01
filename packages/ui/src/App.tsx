import { useEffect, useState } from "react"
import { RouterProvider, useRouterState } from "@tanstack/react-router"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "@/hooks/useTheme"
import { startAppRuntime } from "@/rpc/appRuntime"
import {
  useIsOnboardingComplete,
  useIsServerHydrationComplete,
  useRuntimeStartupState,
} from "@/hooks/useAppRuntime"
import { AppStartupScreen } from "@/components/runtime/AppStartupScreen"
import { router } from "./router"

// Bloom animation runs for 1.3s; after it finishes we cross-fade to the router.
const BLOOM_DURATION_MS = 1300
const CROSSFADE_DURATION_MS = 600

function App() {
  useTheme()
  const startupState = useRuntimeStartupState()
  const hydrationComplete = useIsServerHydrationComplete()
  const onboardingComplete = useIsOnboardingComplete()
  // Subscribe to router state so navigation to /onboarding triggers a re-render
  // and recomputes destinationResolved. A non-reactive read would keep the
  // startup screen mounted forever on first run.
  const isAtOnboardingRoute = useRouterState({
    router,
    select: (state) => state.location.pathname === "/onboarding",
  })
  const destinationReady = startupState.phase === "ready" && hydrationComplete
  const destinationResolved =
    destinationReady && (onboardingComplete || isAtOnboardingRoute)
  const [routerMounted, setRouterMounted] = useState(() => destinationResolved)
  const [startupDismissing, setStartupDismissing] = useState(false)
  const [startupUnmounted, setStartupUnmounted] = useState(() => destinationResolved)

  useEffect(() => {
    void startAppRuntime().catch((error) => {
      console.error("Failed to start app runtime", error)
    })
  }, [])

  // Land the router at /onboarding before the startup screen unmounts so the
  // user does not see a brief dashboard-then-onboarding flash on first run.
  useEffect(() => {
    if (!destinationReady || onboardingComplete) return
    if (isAtOnboardingRoute) return
    void router.navigate?.({ to: "/onboarding" })
  }, [destinationReady, onboardingComplete, isAtOnboardingRoute])

  // Sequence: bloom plays in place → mount the router behind → fade the
  // startup screen → unmount it. The router is painted before the fade starts
  // so the wizard shows through cleanly instead of popping in.
  useEffect(() => {
    if (!destinationResolved) return
    const bloomTimer = setTimeout(() => {
      setRouterMounted(true)
      setStartupDismissing(true)
    }, BLOOM_DURATION_MS)
    return () => clearTimeout(bloomTimer)
  }, [destinationResolved])

  useEffect(() => {
    if (!startupDismissing) return
    const fadeTimer = setTimeout(() => {
      setStartupUnmounted(true)
    }, CROSSFADE_DURATION_MS)
    return () => clearTimeout(fadeTimer)
  }, [startupDismissing])

  return (
    <TooltipProvider>
      {routerMounted && (
        <>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" richColors closeButton />
        </>
      )}
      {!startupUnmounted && (
        <AppStartupScreen
          state={startupState}
          dismissing={startupDismissing}
          fadeDurationMs={CROSSFADE_DURATION_MS}
          onRetry={() => {
            void startAppRuntime().catch((error) => {
              console.error("Failed to retry app runtime", error)
            })
          }}
        />
      )}
    </TooltipProvider>
  )
}

export default App
