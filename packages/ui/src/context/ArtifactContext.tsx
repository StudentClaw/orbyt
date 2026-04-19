import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { ChatArtifact } from "@/lib/artifacts/types"

interface ArtifactContextValue {
  readonly registerArtifacts: (artifacts: readonly ChatArtifact[]) => void
  readonly getArtifact: (id: string) => ChatArtifact | undefined
  readonly openArtifactId: string | null
  readonly openArtifact: (id: string) => void
  readonly closeArtifact: () => void
}

const ArtifactContext = createContext<ArtifactContextValue | null>(null)

interface ArtifactProviderProps {
  readonly children: ReactNode
}

export function ArtifactProvider({ children }: ArtifactProviderProps) {
  const registryRef = useRef<Map<string, ChatArtifact>>(new Map())
  const [, forceRender] = useState(0)
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null)

  const registerArtifacts = useCallback((artifacts: readonly ChatArtifact[]) => {
    if (artifacts.length === 0) return
    const map = registryRef.current
    let changed = false
    for (const a of artifacts) {
      const existing = map.get(a.id)
      if (!existing || existing.content !== a.content) {
        map.set(a.id, a)
        changed = true
      }
    }
    if (changed) {
      forceRender((n) => n + 1)
    }
  }, [])

  const getArtifact = useCallback((id: string) => {
    return registryRef.current.get(id)
  }, [])

  const openArtifact = useCallback((id: string) => {
    setOpenArtifactId(id)
  }, [])

  const closeArtifact = useCallback(() => {
    setOpenArtifactId(null)
  }, [])

  const value = useMemo<ArtifactContextValue>(() => ({
    registerArtifacts,
    getArtifact,
    openArtifactId,
    openArtifact,
    closeArtifact,
  }), [registerArtifacts, getArtifact, openArtifactId, openArtifact, closeArtifact])

  return <ArtifactContext.Provider value={value}>{children}</ArtifactContext.Provider>
}

export function useArtifactContext(): ArtifactContextValue {
  const ctx = useContext(ArtifactContext)
  if (!ctx) {
    throw new Error("useArtifactContext must be used within an ArtifactProvider")
  }
  return ctx
}

export function useArtifactContextOptional(): ArtifactContextValue | null {
  return useContext(ArtifactContext)
}
