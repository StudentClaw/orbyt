export type ArtifactKind = "code" | "markdown" | "html" | "svg" | "text"

export interface ChatArtifact {
  readonly id: string
  readonly messageId: string
  readonly kind: ArtifactKind
  readonly title: string
  readonly filename?: string
  readonly language?: string
  readonly content: string
}

export interface PendingArtifact {
  readonly kind?: ArtifactKind
  readonly title?: string
  readonly language?: string
  readonly filename?: string
  readonly bytesSoFar: number
}

export interface ParseArtifactsResult {
  readonly cleanedContent: string
  readonly artifacts: readonly ChatArtifact[]
  readonly pendingArtifact: PendingArtifact | null
}

export const ARTIFACT_SENTINEL_PREFIX = "[[ARTIFACT:"
export const ARTIFACT_SENTINEL_SUFFIX = "]]"

export function artifactSentinel(id: string): string {
  return `${ARTIFACT_SENTINEL_PREFIX}${id}${ARTIFACT_SENTINEL_SUFFIX}`
}
