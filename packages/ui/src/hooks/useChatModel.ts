import { useCallback, useEffect, useMemo, useState } from "react"
import { useServerConfig } from "@/rpc/serverState"

const STORAGE_KEY = "orbyt:selected-model"
const DEFAULT_MODEL = "gpt-5.4-mini"

function readStoredModel(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function useChatModel() {
  const serverConfig = useServerConfig()
  const availableModels = useMemo(
    () => serverConfig?.chatModels ?? [],
    [serverConfig],
  )
  const defaultModel = serverConfig?.defaultChatModel ?? DEFAULT_MODEL
  const [selectedModel, setSelectedModelState] = useState<string>(defaultModel)

  useEffect(() => {
    if (!serverConfig) {
      return
    }

    const storedModel = readStoredModel()
    const nextModel = storedModel && serverConfig.chatModels.some((model) => model.id === storedModel)
      ? storedModel
      : serverConfig.defaultChatModel

    setSelectedModelState(nextModel)

    try {
      localStorage.setItem(STORAGE_KEY, nextModel)
    } catch {
      // ignore storage errors
    }
  }, [serverConfig])

  const setSelectedModel = useCallback((model: string) => {
    if (serverConfig && !serverConfig.chatModels.some((entry) => entry.id === model)) {
      return
    }

    setSelectedModelState(model)
    try {
      localStorage.setItem(STORAGE_KEY, model)
    } catch {
      // ignore storage errors
    }
  }, [serverConfig])

  return { selectedModel, setSelectedModel, availableModels, defaultModel }
}
