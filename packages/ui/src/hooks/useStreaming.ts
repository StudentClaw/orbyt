import { useState, useCallback } from "react"

export function useStreaming() {
  const [tokens, setTokens] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  const addToken = useCallback((token: string) => {
    setTokens((prev) => [...prev, token])
  }, [])

  const startStreaming = useCallback(() => {
    setTokens([])
    setIsStreaming(true)
  }, [])

  const stopStreaming = useCallback(() => {
    setIsStreaming(false)
  }, [])

  return {
    tokens,
    content: tokens.join(""),
    isStreaming,
    addToken,
    startStreaming,
    stopStreaming,
  }
}
