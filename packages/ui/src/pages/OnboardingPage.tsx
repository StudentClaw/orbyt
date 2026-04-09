import { useRuntimeWelcome } from "@/hooks/useAppRuntime"

export function OnboardingPage() {
  const welcome = useRuntimeWelcome()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Onboarding</h1>
      <p className="mt-2 text-muted-foreground">Get started with Student Claw</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {welcome ? `Connected at ${new Date(welcome.connectedAt).toLocaleTimeString()}` : "Waiting for welcome event"}
      </p>
    </div>
  )
}
