import { useMemo } from "react"
import { Folder, FileCode, FileText, FileImage, FileSpreadsheet, File as FileIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FilePathTreeProps {
  readonly path: string
  readonly className?: string
  /**
   * Absolute path to the current workspace root. When provided and the file
   * path lives inside it, the tree only renders segments relative to the
   * workspace root (so `/Users/paul/Documents/Ch7/src/index.ts` with root
   * `/Users/paul/Documents/Ch7` renders as `src / index.ts`).
   */
  readonly workspaceRoot?: string | null
}

type FileKindIcon = {
  readonly Icon: typeof FileCode
  readonly tint: string
}

const EXT_ICON_MAP: Record<string, FileKindIcon> = {
  ts: { Icon: FileCode, tint: "text-sky-400" },
  tsx: { Icon: FileCode, tint: "text-sky-400" },
  js: { Icon: FileCode, tint: "text-amber-300" },
  jsx: { Icon: FileCode, tint: "text-amber-300" },
  py: { Icon: FileCode, tint: "text-emerald-400" },
  rs: { Icon: FileCode, tint: "text-orange-400" },
  go: { Icon: FileCode, tint: "text-cyan-400" },
  java: { Icon: FileCode, tint: "text-orange-300" },
  c: { Icon: FileCode, tint: "text-blue-300" },
  cpp: { Icon: FileCode, tint: "text-blue-300" },
  h: { Icon: FileCode, tint: "text-blue-300" },
  hpp: { Icon: FileCode, tint: "text-blue-300" },
  json: { Icon: FileCode, tint: "text-amber-200" },
  yaml: { Icon: FileCode, tint: "text-rose-300" },
  yml: { Icon: FileCode, tint: "text-rose-300" },
  toml: { Icon: FileCode, tint: "text-rose-300" },
  md: { Icon: FileText, tint: "text-slate-300" },
  mdx: { Icon: FileText, tint: "text-slate-300" },
  txt: { Icon: FileText, tint: "text-slate-300" },
  pdf: { Icon: FileText, tint: "text-red-300" },
  css: { Icon: FileCode, tint: "text-fuchsia-300" },
  scss: { Icon: FileCode, tint: "text-fuchsia-300" },
  html: { Icon: FileCode, tint: "text-orange-300" },
  png: { Icon: FileImage, tint: "text-purple-300" },
  jpg: { Icon: FileImage, tint: "text-purple-300" },
  jpeg: { Icon: FileImage, tint: "text-purple-300" },
  gif: { Icon: FileImage, tint: "text-purple-300" },
  webp: { Icon: FileImage, tint: "text-purple-300" },
  svg: { Icon: FileImage, tint: "text-purple-300" },
  csv: { Icon: FileSpreadsheet, tint: "text-emerald-300" },
  xlsx: { Icon: FileSpreadsheet, tint: "text-emerald-300" },
}

function iconForFile(name: string): FileKindIcon {
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf(".")
  if (dot <= 0) return { Icon: FileIcon, tint: "text-muted-foreground" }
  const ext = lower.slice(dot + 1)
  return EXT_ICON_MAP[ext] ?? { Icon: FileIcon, tint: "text-muted-foreground" }
}

function stripFileProtocol(p: string): string {
  return p.replace(/^file:\/\//, "")
}

function trimTrailingSlash(p: string): string {
  return p.replace(/\/+$/, "")
}

/**
 * Returns a path relative to `root` when `path` lives inside it. If `path`
 * is outside the root (or `root` is empty/null), the absolute path is
 * returned so the user can tell the file is external.
 */
export function scopePathToRoot(
  path: string,
  root: string | null | undefined,
): string {
  const abs = stripFileProtocol(path)
  if (!root) return abs
  const cleanRoot = trimTrailingSlash(stripFileProtocol(root))
  if (cleanRoot === "") return abs
  if (abs === cleanRoot) return ""
  if (abs.startsWith(cleanRoot + "/")) {
    return abs.slice(cleanRoot.length + 1)
  }
  return abs
}

function normalizeSegments(path: string): readonly string[] {
  const cleaned = path.replace(/^\/+/, "").replace(/\/+$/, "")
  if (cleaned === "") return []
  return cleaned.split("/").filter((s) => s.length > 0)
}

export function FilePathTree({ path, className, workspaceRoot }: FilePathTreeProps) {
  const segments = useMemo(
    () => normalizeSegments(scopePathToRoot(path, workspaceRoot)),
    [path, workspaceRoot],
  )

  if (segments.length === 0) return null

  const lastIdx = segments.length - 1

  return (
    <div
      data-testid="file-path-tree"
      data-file-path={path}
      className={cn(
        "pointer-events-none relative flex w-[260px] flex-col gap-0.5 rounded-2xl border border-border/40 bg-popover/80 p-3 text-xs shadow-2xl ring-1 ring-foreground/5 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
        <span className="size-1 rounded-full bg-muted-foreground/60" />
        File path
      </div>
      {segments.map((seg, idx) => {
        const isLeaf = idx === lastIdx
        const { Icon: LeafIcon, tint } = isLeaf
          ? iconForFile(seg)
          : { Icon: Folder, tint: "text-muted-foreground/80" }
        return (
          <div
            key={`${idx}:${seg}`}
            className="relative flex items-center gap-1.5"
            style={{ paddingLeft: `${idx * 12}px` }}
          >
            {Array.from({ length: idx }).map((_, barIdx) => (
              <span
                key={barIdx}
                aria-hidden
                className="absolute top-0 bottom-0 w-px bg-border/60"
                style={{ left: `${barIdx * 12 + 6}px` }}
              />
            ))}
            {idx > 0 ? (
              <span
                aria-hidden
                className="absolute top-1/2 h-px bg-border/60"
                style={{
                  left: `${(idx - 1) * 12 + 6}px`,
                  width: "9px",
                }}
              />
            ) : null}
            <LeafIcon className={cn("relative z-10 size-3.5 shrink-0", tint)} />
            <span
              className={cn(
                "relative z-10 truncate",
                isLeaf ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {seg}
            </span>
          </div>
        )
      })}
    </div>
  )
}
