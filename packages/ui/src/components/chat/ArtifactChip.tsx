import { FileCode2Icon, FileTextIcon, FileIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useArtifactContext } from "@/context/ArtifactContext"
import type { ArtifactKind, PendingArtifact } from "@/lib/artifacts/types"

interface ArtifactChipProps {
  readonly artifactId: string
  readonly className?: string
}

export function ArtifactChip({ artifactId, className }: ArtifactChipProps) {
  const { getArtifact, openArtifact } = useArtifactContext()
  const artifact = getArtifact(artifactId)

  if (!artifact) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={cn("my-1 inline-flex items-center gap-2 align-middle", className)}
      >
        <FileIcon className="size-4" aria-hidden />
        <span className="text-xs text-muted-foreground">Artifact unavailable</span>
      </Button>
    )
  }

  const Icon = iconForKind(artifact.kind)
  const label = artifact.title || artifact.filename || "Artifact"

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openArtifact(artifact.id)}
      className={cn(
        "my-1 inline-flex max-w-full items-center gap-2 align-middle rounded-lg",
        className,
      )}
      data-testid="artifact-chip"
      data-artifact-id={artifact.id}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate text-left text-xs font-medium">{label}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {artifact.language ?? artifact.kind}
      </span>
    </Button>
  )
}

interface PendingArtifactChipProps {
  readonly pending: PendingArtifact
  readonly className?: string
}

export function PendingArtifactChip({ pending, className }: PendingArtifactChipProps) {
  const label = pending.title ?? pending.filename ?? "Generating artifact"
  return (
    <div
      className={cn(
        "my-1 inline-flex max-w-full items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-1.5",
        className,
      )}
      data-testid="pending-artifact-chip"
      aria-live="polite"
    >
      <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden />
      <span className="truncate text-left text-xs font-medium">{label}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {pending.language ?? pending.kind ?? "streaming"} · {pending.bytesSoFar}B
      </span>
    </div>
  )
}

function iconForKind(kind: ArtifactKind) {
  switch (kind) {
    case "code":
      return FileCode2Icon
    case "markdown":
    case "text":
      return FileTextIcon
    default:
      return FileIcon
  }
}
