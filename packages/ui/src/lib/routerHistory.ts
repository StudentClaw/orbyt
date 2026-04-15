import { createBrowserHistory, createMemoryHistory } from "@tanstack/react-router"

export interface HistoryLocationSource {
  readonly protocol: string
  readonly hash: string
}

function getHistoryLocationSource(): HistoryLocationSource | null {
  if (typeof window === "undefined") {
    return null
  }

  return {
    protocol: window.location.protocol,
    hash: window.location.hash,
  }
}

export function resolveInitialRouteFromHash(hash: string): string {
  if (hash === "" || hash === "#") {
    return "/"
  }

  return hash.startsWith("#/") ? hash.slice(1) : "/"
}

export function createAppHistory(source: HistoryLocationSource | null = getHistoryLocationSource()) {
  if (!source) {
    return createMemoryHistory({ initialEntries: ["/"] })
  }

  if (source.protocol === "file:") {
    return createMemoryHistory({
      initialEntries: [resolveInitialRouteFromHash(source.hash)],
    })
  }

  return createBrowserHistory()
}
