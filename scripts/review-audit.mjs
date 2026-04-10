import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const MAX_FILE_LINES = 800
const MAX_FUNCTION_LINES = 50
const MAX_NESTING_DEPTH = 4

const rootDir = process.cwd()

const auditRoots = [
  "packages/electron/src",
  "packages/server/src",
  "packages/ui/src/rpc",
]

const auditFileAdditions = [
  "packages/contracts/src/protocol/desktop.ts",
  "packages/contracts/src/protocol/orchestration.ts",
  "packages/ui/src/hooks/useAppRuntime.ts",
]

const publicApiFiles = new Set([
  "packages/contracts/src/protocol/desktop.ts",
  "packages/contracts/src/protocol/orchestration.ts",
  "packages/electron/src/ipc/bridge.ts",
  "packages/electron/src/server/lifecycle.ts",
  "packages/server/src/config/ConfigService.ts",
  "packages/server/src/db/Database.ts",
  "packages/server/src/orchestration/OrchestrationService.ts",
  "packages/server/src/runtime/ServerReadiness.ts",
  "packages/server/src/ws/PushBus.ts",
  "packages/server/src/ws/Router.ts",
  "packages/server/src/ws/WebSocketServer.ts",
  "packages/server/src/ws/handshake.ts",
  "packages/ui/src/rpc/appRuntime.ts",
  "packages/ui/src/rpc/atomRegistry.ts",
  "packages/ui/src/rpc/wsRpcClient.ts",
  "packages/ui/src/rpc/wsTransport.ts",
])

const ignorePatterns = [
  /\/__tests__\//,
  /\/__mocks__\//,
  /\/dist\//,
  /\/node_modules\//,
  /\/packages\/ui\/src\/components\/ui\//,
  /\.test\.tsx?$/,
  /\.tsbuildinfo$/,
]

const findings = []
const ts = await loadTypeScript()

function main() {
  const files = collectAuditFiles()

  for (const file of files) {
    const sourceText = fs.readFileSync(file, "utf8")
    const relativePath = path.relative(rootDir, file).replaceAll(path.sep, "/")
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true)

    auditFileLength(relativePath, sourceText)
    auditConsoleCalls(relativePath, sourceFile)
    auditFunctionLengths(relativePath, sourceFile)
    auditNestingDepth(relativePath, sourceFile)
    if (publicApiFiles.has(relativePath)) {
      auditJsDoc(relativePath, sourceFile)
    }
  }

  findings.sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file)
    }
    return left.line - right.line
  })

  if (findings.length === 0) {
    process.stdout.write("review:audit passed\n")
    return
  }

  for (const finding of findings) {
    process.stderr.write(
      `${finding.severity} ${finding.file}:${finding.line} ${finding.description}\n` +
      `  Suggested fix: ${finding.suggestedFix}\n`,
    )
  }

  process.exitCode = 1
}

async function loadTypeScript() {
  const candidates = [
    path.join(rootDir, "node_modules", ".bun"),
    path.join(rootDir, "packages", "contracts", "node_modules"),
    path.join(rootDir, "packages", "server", "node_modules"),
    path.join(rootDir, "packages", "ui", "node_modules"),
    path.join(rootDir, "packages", "electron", "node_modules"),
  ]

  for (const candidate of candidates) {
    const modulePath = findTypeScriptModule(candidate)
    if (!modulePath) {
      continue
    }

    const imported = await import(pathToFileURL(modulePath).href)
    return imported.default ?? imported
  }

  throw new Error("Unable to locate the installed TypeScript runtime for review:audit")
}

function findTypeScriptModule(searchRoot) {
  if (!fs.existsSync(searchRoot)) {
    return null
  }

  if (searchRoot.endsWith(path.join("node_modules", ".bun"))) {
    for (const entry of fs.readdirSync(searchRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("typescript@")) {
        continue
      }

      const candidate = path.join(
        searchRoot,
        entry.name,
        "node_modules",
        "typescript",
        "lib",
        "typescript.js",
      )
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
    return null
  }

  const candidate = path.join(searchRoot, "typescript", "lib", "typescript.js")
  return fs.existsSync(candidate) ? candidate : null
}

function collectAuditFiles() {
  const files = new Set()

  for (const root of auditRoots) {
    walkDirectory(path.join(rootDir, root), files)
  }

  for (const file of auditFileAdditions) {
    files.add(path.join(rootDir, file))
  }

  return [...files]
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .filter((file) => !isIgnored(path.relative(rootDir, file).replaceAll(path.sep, "/")))
    .sort()
}

function walkDirectory(directory, files) {
  if (!fs.existsSync(directory)) {
    return
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const nextPath = path.join(directory, entry.name)
    const relativePath = path.relative(rootDir, nextPath).replaceAll(path.sep, "/")
    if (isIgnored(relativePath)) {
      continue
    }

    if (entry.isDirectory()) {
      walkDirectory(nextPath, files)
      continue
    }

    files.add(nextPath)
  }
}

function isIgnored(relativePath) {
  return ignorePatterns.some((pattern) => pattern.test(`/${relativePath}`))
}

function auditFileLength(relativePath, sourceText) {
  const lineCount = sourceText.split(/\r?\n/).length
  if (lineCount <= MAX_FILE_LINES) {
    return
  }

  findings.push({
    severity: "HIGH",
    file: relativePath,
    line: 1,
    description: `file length ${lineCount} exceeds ${MAX_FILE_LINES} lines`,
    suggestedFix: "Split the module into smaller units with focused responsibilities.",
  })
}

function auditConsoleCalls(relativePath, sourceFile) {
  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
      return
    }

    if (node.expression.expression.getText(sourceFile) !== "console") {
      return
    }

    const method = node.expression.name.text
    if (method !== "log" && method !== "error") {
      return
    }

    findings.push({
      severity: "HIGH",
      file: relativePath,
      line: getLine(sourceFile, node),
      description: `console.${method} is not allowed in audited runtime code`,
      suggestedFix: "Route startup or diagnostic output through an explicit stdout/stderr helper or logger.",
    })
  })
}

function auditFunctionLengths(relativePath, sourceFile) {
  walk(sourceFile, (node) => {
    if (!isFunctionLike(node)) {
      return
    }

    const startLine = getLine(sourceFile, node)
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1
    const length = endLine - startLine + 1
    if (length <= MAX_FUNCTION_LINES) {
      return
    }

    findings.push({
      severity: "HIGH",
      file: relativePath,
      line: startLine,
      description: `${describeFunction(node, sourceFile)} spans ${length} lines`,
      suggestedFix: "Extract smaller helpers so each function stays within the audit limit.",
    })
  })
}

function auditNestingDepth(relativePath, sourceFile) {
  let deepestDepth = 0
  let deepestNode = sourceFile

  walk(sourceFile, (node) => {
    if (!isFunctionLike(node)) {
      return
    }

    const result = measureNesting(node)
    if (result.depth > deepestDepth) {
      deepestDepth = result.depth
      deepestNode = result.node
    }
  })

  if (deepestDepth <= MAX_NESTING_DEPTH) {
    return
  }

  findings.push({
    severity: "HIGH",
    file: relativePath,
    line: getLine(sourceFile, deepestNode),
    description: `nesting depth ${deepestDepth} exceeds ${MAX_NESTING_DEPTH}`,
    suggestedFix: "Flatten the control flow with smaller helpers, guards, or early returns.",
  })
}

function auditJsDoc(relativePath, sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!isExported(statement) || hasJsDoc(statement)) {
      continue
    }

    if (ts.isExportDeclaration(statement)) {
      continue
    }

    findings.push({
      severity: "HIGH",
      file: relativePath,
      line: getLine(sourceFile, statement),
      description: `public export ${describeStatement(statement, sourceFile)} is missing JSDoc`,
      suggestedFix: "Add a short JSDoc comment describing the exported public API.",
    })
  }
}

function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
}

function describeFunction(node, sourceFile) {
  if ("name" in node && node.name && ts.isIdentifier(node.name)) {
    return `function ${node.name.text}`
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return `function ${parent.name.text}`
    }
  }

  return "anonymous function"
}

function describeStatement(statement, sourceFile) {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations
      .map((declaration) => declaration.name.getText(sourceFile))
      .join(", ")
  }

  if ("name" in statement && statement.name && ts.isIdentifier(statement.name)) {
    return statement.name.text
  }

  return statement.getText(sourceFile).split(/\s+/).slice(0, 4).join(" ")
}

function isExported(node) {
  if (!ts.canHaveModifiers(node)) {
    return false
  }

  return ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function hasJsDoc(node) {
  return ts.getJSDocCommentsAndTags(node).length > 0
}

function getLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function measureNesting(rootNode) {
  const controlKinds = new Set([
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.SwitchStatement,
    ts.SyntaxKind.CaseClause,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.ForOfStatement,
    ts.SyntaxKind.WhileStatement,
    ts.SyntaxKind.DoStatement,
    ts.SyntaxKind.TryStatement,
    ts.SyntaxKind.CatchClause,
    ts.SyntaxKind.ConditionalExpression,
  ])

  const deepest = { depth: 0, node: rootNode }

  const visit = (node, depth) => {
    const nextDepth = controlKinds.has(node.kind) ? depth + 1 : depth
    if (nextDepth > deepest.depth) {
      deepest.depth = nextDepth
      deepest.node = node
    }
    ts.forEachChild(node, (child) => visit(child, nextDepth))
  }

  visit(rootNode, 0)
  return deepest
}

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

main()
