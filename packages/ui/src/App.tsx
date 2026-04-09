import { useEffect } from "react"
import { RouterProvider } from "@tanstack/react-router"
import { startAppRuntime } from "@/rpc/appRuntime"
import { router } from "./router"

function App() {
  useEffect(() => {
    void startAppRuntime().catch((error) => {
      console.error("Failed to start app runtime", error)
    })
  }, [])

  return <RouterProvider router={router} />
}

export default App
