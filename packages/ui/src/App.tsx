import { useEffect, useState } from "react"
import { RouterProvider } from "@tanstack/react-router"
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

const REVEAL_DURATION_MS = 1300

function isAtOnboardingRoute(): boolean {
  return router.state?.location?.pathname === "/onboarding"
}

function App() {
  useTheme()
  const startupState = useRuntimeStartupState()
  const hydrationComplete = useIsServerHydrationComplete()
  const onboardingComplete = useIsOnboardingComplete()
  const destinationReady = startupState.phase === "ready" && hydrationComplete
  const destinationResolved =
    destinationReady && (onboardingComplete || isAtOnboardingRoute())
  const [dismissed, setDismissed] = useState(() => destinationResolved)

  useEffect(() => {
    void startAppRuntime().catch((error) => {
      console.error("Failed to start app runtime", error)
    })
  }, [])

  // Land the router at /onboarding before the startup screen unmounts so the
  // user does not see a brief dashboard-then-onboarding flash on first run.
  useEffect(() => {
    if (!destinationReady || onboardingComplete) return
    if (isAtOnboardingRoute()) return
    void router.navigate?.({ to: "/onboarding" })
  }, [destinationReady, onboardingComplete])

  useEffect(() => {
    if (!destinationResolved || dismissed) return
    const timer = setTimeout(() => setDismissed(true), REVEAL_DURATION_MS)
    return () => clearTimeout(timer)
  }, [destinationResolved, dismissed])

  if (!dismissed) {
    return (
      <TooltipProvider>
        <AppStartupScreen
          state={startupState}
          onRetry={() => {
            void startAppRuntime().catch((error) => {
              console.error("Failed to retry app runtime", error)
            })
          }}
        />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  )
}

export default App
