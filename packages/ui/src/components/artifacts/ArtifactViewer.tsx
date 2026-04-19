import DOMPurify from "dompurify"
import { MarkdownContent } from "@/components/chat/MarkdownContent"
import type { ChatArtifact } from "@/lib/artifacts/types"

interface ArtifactViewerProps {
  readonly artifact: ChatArtifact
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  switch (artifact.kind) {
    case "markdown":
      return (
        <div className="prose prose-sm max-w-none text-sm text-foreground">
          <MarkdownContent content={artifact.content} />
        </div>
      )
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
          <code className={artifact.language ? `language-${artifact.language}` : undefined}>
            {artifact.content}
          </code>
        </pre>
      )
    case "html":
      return (
        <iframe
          title={artifact.title}
          srcDoc={artifact.content}
          sandbox=""
          className="h-full min-h-[400px] w-full rounded-lg border border-border bg-background"
        />
      )
    case "svg": {
      const clean = DOMPurify.sanitize(artifact.content, {
        USE_PROFILES: { svg: true, svgFilters: true },
      })
      return (
        <div
          className="flex w-full items-center justify-center rounded-lg border border-border bg-background p-4"
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      )
    }
    case "text":
    default:
      return (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-relaxed">
          {artifact.content}
        </pre>
      )
  }
}
