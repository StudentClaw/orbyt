import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export type UpdateManifestFile = {
  readonly url: string
  readonly sha512?: string
  readonly size?: string
  readonly blockMapSize?: string
}

export type UpdateManifest = {
  readonly version: string
  readonly files: readonly UpdateManifestFile[]
  readonly path?: string
  readonly sha512?: string
  readonly releaseDate?: string
}

function parseTopLevelValue(line: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*(.+)$`, "u").exec(line)
  return match?.[1]?.trim()
}

export function parseMacUpdateManifest(raw: string): UpdateManifest {
  const lines = raw.split(/\r?\n/u)
  const files: UpdateManifestFile[] = []
  let currentFile: Record<string, string> | null = null
  let version = ""
  let manifestPath: string | undefined
  let sha512: string | undefined
  let releaseDate: string | undefined

  const finishFile = () => {
    if (currentFile?.url) {
      files.push({
        url: currentFile.url,
        sha512: currentFile.sha512,
        size: currentFile.size,
        blockMapSize: currentFile.blockMapSize,
      })
    }
    currentFile = null
  }

  for (const line of lines) {
    const fileStart = /^\s*-\s+url:\s*(.+)$/u.exec(line)
    if (fileStart?.[1]) {
      finishFile()
      currentFile = { url: fileStart[1].trim() }
      continue
    }

    const fileProperty = /^\s+(sha512|size|blockMapSize):\s*(.+)$/u.exec(line)
    if (currentFile && fileProperty?.[1] && fileProperty[2]) {
      currentFile[fileProperty[1]] = fileProperty[2].trim()
      continue
    }

    version = parseTopLevelValue(line, "version") ?? version
    manifestPath = parseTopLevelValue(line, "path") ?? manifestPath
    sha512 = parseTopLevelValue(line, "sha512") ?? sha512
    releaseDate = parseTopLevelValue(line, "releaseDate") ?? releaseDate
  }
  finishFile()

  if (!version) {
    throw new Error("Missing update manifest version.")
  }
  if (files.length === 0) {
    throw new Error("Missing update manifest files.")
  }

  return {
    version,
    files,
    path: manifestPath,
    sha512,
    releaseDate,
  }
}

export function mergeMacUpdateManifests(primary: UpdateManifest, secondary: UpdateManifest): UpdateManifest {
  if (primary.version !== secondary.version) {
    throw new Error(`Cannot merge update manifests for different versions: ${primary.version} and ${secondary.version}.`)
  }

  const filesByUrl = new Map<string, UpdateManifestFile>()
  for (const file of [...primary.files, ...secondary.files]) {
    filesByUrl.set(file.url, file)
  }

  return {
    ...primary,
    files: [...filesByUrl.values()],
  }
}

export function serializeMacUpdateManifest(manifest: UpdateManifest): string {
  const lines = [
    `version: ${manifest.version}`,
    "files:",
  ]
  for (const file of manifest.files) {
    lines.push(`  - url: ${file.url}`)
    if (file.sha512) lines.push(`    sha512: ${file.sha512}`)
    if (file.size) lines.push(`    size: ${file.size}`)
    if (file.blockMapSize) lines.push(`    blockMapSize: ${file.blockMapSize}`)
  }
  if (manifest.path) lines.push(`path: ${manifest.path}`)
  if (manifest.sha512) lines.push(`sha512: ${manifest.sha512}`)
  if (manifest.releaseDate) lines.push(`releaseDate: ${manifest.releaseDate}`)
  return `${lines.join("\n")}\n`
}

export function mergeMacUpdateManifestFiles(primaryPath: string, secondaryPath: string, outputPath = primaryPath): void {
  const primary = parseMacUpdateManifest(readFileSync(primaryPath, "utf8"))
  const secondary = parseMacUpdateManifest(readFileSync(secondaryPath, "utf8"))
  writeFileSync(outputPath, serializeMacUpdateManifest(mergeMacUpdateManifests(primary, secondary)), "utf8")
}

if (import.meta.main) {
  const [, , primaryPathArg, secondaryPathArg, outputPathArg] = process.argv
  if (!primaryPathArg || !secondaryPathArg) {
    throw new Error("Usage: bun scripts/merge-mac-update-manifests.ts <primary> <secondary> [output]")
  }

  mergeMacUpdateManifestFiles(
    path.resolve(primaryPathArg),
    path.resolve(secondaryPathArg),
    outputPathArg ? path.resolve(outputPathArg) : undefined,
  )
}
