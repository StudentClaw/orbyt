import { Children, Fragment, isValidElement } from "react"
import type { ReactNode } from "react"
import { IpcChannel } from "@orbyt/contracts"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { Components } from "react-markdown"
import "katex/dist/katex.min.css"
import { normalizeLatex } from "@/lib/markdown/normalizeLatex"
import { ArtifactChip } from "@/components/chat/ArtifactChip"
import { useArtifactContextOptional } from "@/context/ArtifactContext"

interface MarkdownContentProps {
  readonly content: string
}

const SENTINEL_REGEX = /\[\[ARTIFACT:([^\]]+)\]\]/g
const URL_SCHEME_REGEX = /^[A-Za-z][A-Za-z\d+.-]*:/
const APP_ROUTE_PREFIXES = ["/chat", "/settings", "/plugins", "/activity", "/onboarding", "/assignments"] as const

function renderWithChips(children: ReactNode, enabled: boolean): ReactNode {
  if (!enabled) return children
  const out: ReactNode[] = []
  Children.forEach(children, (child, idx) => {
    if (typeof child !== "string") {
      if (isValidElement(child)) {
        out.push(child)
      } else if (child !== null && child !== undefined && child !== false) {
        out.push(child)
      }
      return
    }
    let lastIndex = 0
    let match: RegExpExecArray | null
    const regex = new RegExp(SENTINEL_REGEX.source, "g")
    let chunk = 0
    while ((match = regex.exec(child)) !== null) {
      if (match.index > lastIndex) {
        out.push(<Fragment key={`${idx}-t-${chunk}`}>{child.slice(lastIndex, match.index)}</Fragment>)
      }
      out.push(<ArtifactChip key={`${idx}-c-${chunk}`} artifactId={match[1]!} />)
      lastIndex = match.index + match[0].length
      chunk += 1
    }
    if (lastIndex < child.length) {
      out.push(<Fragment key={`${idx}-t-tail`}>{child.slice(lastIndex)}</Fragment>)
    }
  })
  return out
}

function stripHrefSuffixes(href: string): string {
  let end = href.length
  const hashIndex = href.indexOf("#")
  if (hashIndex !== -1) {
    end = Math.min(end, hashIndex)
  }
  const queryIndex = href.indexOf("?")
  if (queryIndex !== -1) {
    end = Math.min(end, queryIndex)
  }
  return href.slice(0, end)
}

function decodeHrefPath(pathname: string): string {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

function normalizeLocalFilePath(pathname: string): string | null {
  const withoutLine = pathname.replace(/:\d+$/, "")
  if (withoutLine.length === 0) {
    return null
  }

  if (/^\/[A-Za-z]:\//.test(withoutLine)) {
    return withoutLine.slice(1)
  }

  return withoutLine
}

function isAppRouteHref(href: string): boolean {
  const pathOnly = stripHrefSuffixes(href)
  return pathOnly === "/"
    || APP_ROUTE_PREFIXES.some((prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`))
}

function localFilePathFromHref(href?: string): string | null {
  if (!href) {
    return null
  }

  const trimmed = href.trim()
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null
  }

  if (trimmed.startsWith("file://")) {
    try {
      const url = new URL(trimmed)
      return normalizeLocalFilePath(decodeHrefPath(url.pathname))
    } catch {
      return normalizeLocalFilePath(decodeHrefPath(trimmed.slice("file://".length)))
    }
  }

  if (trimmed.startsWith("//") || URL_SCHEME_REGEX.test(trimmed)) {
    return null
  }

  if (!trimmed.startsWith("/") || isAppRouteHref(trimmed)) {
    return null
  }

  return normalizeLocalFilePath(decodeHrefPath(stripHrefSuffixes(trimmed)))
}

function useComponents(withChips: boolean): Components {
  return {
    p: ({ children }) => (
      <p className="mb-3 last:mb-0">{renderWithChips(children, withChips)}</p>
    ),
    h1: ({ children }) => <h1 className="mb-3 text-lg font-semibold">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-2 text-base font-semibold">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
    ul: ({ children }) => <ul className="mb-3 list-disc pl-5 last:mb-0">{children}</ul>,
    ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 last:mb-0">{children}</ol>,
    li: ({ children }) => <li className="mb-1">{renderWithChips(children, withChips)}</li>,
    code: ({ className, children, ...props }) => {
      const isBlock = className?.includes("language-")
      if (isBlock) {
        return (
          <code className={`${className ?? ""} block`} {...props}>
            {children}
          </code>
        )
      }
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
          {children}
        </code>
      )
    },
    pre: ({ children }) => (
      <pre className="mb-3 overflow-x-auto rounded-lg bg-muted p-3 text-sm last:mb-0">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mb-3 border-l-2 border-border pl-4 text-muted-foreground last:mb-0">
        {children}
      </blockquote>
    ),
    a: ({ children, href }) => {
      const localFilePath = localFilePathFromHref(href)
      return (
        <a
          href={href}
          className="text-primary underline underline-offset-2"
          target={localFilePath ? undefined : "_blank"}
          rel={localFilePath ? undefined : "noopener noreferrer"}
          onClick={(event) => {
            if (!localFilePath || !window.electronAPI?.invoke) {
              return
            }

            event.preventDefault()
            void window.electronAPI.invoke(IpcChannel.FILE_REVEAL_IN_FOLDER, { path: localFilePath })
          }}
        >
          {children}
        </a>
      )
    },
    table: ({ children }) => (
      <div className="mb-3 overflow-x-auto last:mb-0">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-border px-3 py-1.5 text-left font-medium">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border border-border px-3 py-1.5">{children}</td>
    ),
    hr: () => <hr className="my-4 border-border" />,
  }
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const artifactCtx = useArtifactContextOptional()
  const components = useComponents(artifactCtx !== null)
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {normalizeLatex(content)}
    </Markdown>
  )
}
