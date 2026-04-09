export function createId(prefix = "sc"): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function noop(): void {
  return undefined
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
