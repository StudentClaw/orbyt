import { useEffect, useState } from "react"
import { RouterProvider } from "@tanstack/react-router"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "@/hooks/useTheme"
import { startAppRuntime } from "@/rpc/appRuntime"
import { useRuntimeStartupState } from "@/hooks/useAppRuntime"
import { AppStartupScreen } from "@/components/runtime/AppStartupScreen"
import { router } from "./router"

const REVEAL_DURATION_MS = 1300

function App() {
  useTheme()
  const startupState = useRuntimeStartupState()
  const [dismissed, setDismissed] = useState(() => startupState.phase === "ready")

  useEffect(() => {
    void startAppRuntime().catch((error) => {
      console.error("Failed to start app runtime", error)
    })
  }, [])

  useEffect(() => {
    if (startupState.phase !== "ready" || dismissed) return
    const timer = setTimeout(() => setDismissed(true), REVEAL_DURATION_MS)
    return () => clearTimeout(timer)
  }, [startupState.phase, dismissed])

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
