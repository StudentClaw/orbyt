import { useEffect } from "react"
import { RouterProvider } from "@tanstack/react-router"
import { AppStartupScreen } from "@/components/runtime/AppStartupScreen"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useRuntimeStartupState } from "@/hooks/useAppRuntime"
import { useTheme } from "@/hooks/useTheme"
import { startAppRuntime } from "@/rpc/appRuntime"
import { router } from "./router"

function App() {
  useTheme()
  const startupState = useRuntimeStartupState()

  useEffect(() => {
    void startAppRuntime().catch((error) => {
      console.error("Failed to start app runtime", error)
    })
  }, [])

  if (startupState.phase !== "ready") {
    return (
      <AppStartupScreen
        state={startupState}
        onRetry={() => {
          void startAppRuntime().catch((error) => {
            console.error("Failed to retry app runtime startup", error)
          })
        }}
      />
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
