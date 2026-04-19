import { useState } from "react"
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useArtifactContext } from "@/context/ArtifactContext"
import { ArtifactViewer } from "./ArtifactViewer"
import type { ChatArtifact } from "@/lib/artifacts/types"

const MIME_BY_KIND: Readonly<Record<ChatArtifact["kind"], string>> = {
  code: "text/plain",
  markdown: "text/markdown",
  html: "text/html",
  svg: "image/svg+xml",
  text: "text/plain",
}

export function ArtifactDrawer() {
  const { openArtifactId, getArtifact, closeArtifact } = useArtifactContext()
  const artifact = openArtifactId ? getArtifact(openArtifactId) : undefined
  const isOpen = Boolean(artifact)

  return (
    <Sheet open={isOpen} onOpenChange={(next) => { if (!next) closeArtifact() }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        {artifact ? <DrawerBody artifact={artifact} /> : null}
      </SheetContent>
    </Sheet>
  )
}

interface DrawerBodyProps {
  readonly artifact: ChatArtifact
}

function DrawerBody({ artifact }: DrawerBodyProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard denied — silent; user can still download
    }
  }

  const handleDownload = () => {
    const mime = MIME_BY_KIND[artifact.kind]
    const filename = artifact.filename ?? defaultFilename(artifact)
    const blob = new Blob([artifact.content], { type: mime })
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(href)
  }

  return (
    <>
      <SheetHeader className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold">
              {artifact.title}
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <Badge variant="secondary" className="uppercase">{artifact.kind}</Badge>
              {artifact.language ? (
                <Badge variant="outline">{artifact.language}</Badge>
              ) : null}
              {artifact.filename ? (
                <span className="text-muted-foreground">{artifact.filename}</span>
              ) : null}
            </SheetDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleCopy()}
              aria-label={copied ? "Copied" : "Copy artifact"}
              data-testid="artifact-copy"
            >
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              aria-label="Download artifact"
              data-testid="artifact-download"
            >
              <DownloadIcon className="size-4" />
            </Button>
          </div>
        </div>
      </SheetHeader>
      <div className="flex-1 overflow-auto p-4">
        <ArtifactViewer artifact={artifact} />
      </div>
    </>
  )
}

function defaultFilename(artifact: ChatArtifact): string {
  const ext = extFor(artifact)
  const base = sanitise(artifact.title) || "artifact"
  return `${base}${ext}`
}

function extFor(artifact: ChatArtifact): string {
  switch (artifact.kind) {
    case "markdown":
      return ".md"
    case "html":
      return ".html"
    case "svg":
      return ".svg"
    case "code":
      return artifact.language ? `.${artifact.language}` : ".txt"
    case "text":
    default:
      return ".txt"
  }
}

function sanitise(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60)
}
