import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { reconcileBundledSkills } from "./skill-reconciler.js"

export type PrepareIsolatedCodexRuntimeOptions = {
  readonly bundleSkillsRoot?: string
}

export type PluginGatewayLaunchConfig = {
  readonly bridgeUrl: string
  readonly bridgeEventsUrl: string
  readonly bridgeToken: string
  readonly mcpUrl: string
  readonly mcpBearerToken: string
  readonly mcpServerName: string
}

const ORBYT_GATEWAY_TOKEN_ENV = "ORBYT_GATEWAY_BEARER_TOKEN"

function copyIfMissing(sourcePath: string, destinationPath: string): void {
  if (!existsSync(sourcePath) || existsSync(destinationPath)) {
    return
  }

  writeFileSync(destinationPath, readFileSync(sourcePath))
}

function buildIsolatedConfigToml(gateway?: PluginGatewayLaunchConfig): string {
  if (!gateway?.mcpUrl) {
    return ""
  }

  return [
    `[mcp_servers.${JSON.stringify(gateway.mcpServerName)}]`,
    `url = ${JSON.stringify(gateway.mcpUrl)}`,
    `bearer_token_env_var = ${JSON.stringify(ORBYT_GATEWAY_TOKEN_ENV)}`,
    `enabled = true`,
    "",
  ].join("\n")
}

function resolveBundledSkillsRoot(explicit?: string): string | null {
  if (explicit) {
    return existsSync(explicit) ? explicit : null
  }
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (resourcesPath) {
    const packagedPath = path.join(resourcesPath, "skills")
    if (existsSync(packagedPath)) {
      return packagedPath
    }
  }
  return null
}

export function prepareIsolatedCodexRuntime(
  userDataPath: string,
  gateway?: PluginGatewayLaunchConfig,
  options?: PrepareIsolatedCodexRuntimeOptions,
): {
  readonly codexHomePath: string
  readonly codexProcessHomePath: string
} {
  const codexHomePath = path.join(userDataPath, "codex-home")
  const codexProcessHomePath = path.join(userDataPath, "codex-user-home")

  mkdirSync(codexHomePath, { recursive: true })
  mkdirSync(codexProcessHomePath, { recursive: true })
  const userSkillsDir = path.join(codexProcessHomePath, ".agents", "skills")
  mkdirSync(userSkillsDir, { recursive: true })

  const bundleRoot = resolveBundledSkillsRoot(options?.bundleSkillsRoot)
  if (bundleRoot) {
    reconcileBundledSkills({
      bundleRoot,
      userSkillsDir,
      statePath: path.join(codexProcessHomePath, ".agents", "skills.state.json"),
    })
  }

  const globalCodexHome = path.join(process.env.HOME ?? "", ".codex")
  copyIfMissing(path.join(globalCodexHome, "auth.json"), path.join(codexHomePath, "auth.json"))
  copyIfMissing(path.join(globalCodexHome, "installation_id"), path.join(codexHomePath, "installation_id"))

  const configPath = path.join(codexHomePath, "config.toml")
  if (gateway || !existsSync(configPath)) {
    writeFileSync(configPath, buildIsolatedConfigToml(gateway), "utf8")
  }

  return {
    codexHomePath,
    codexProcessHomePath,
  }
}

export function buildIsolatedCodexEnv(
  userDataPath: string,
  gateway?: PluginGatewayLaunchConfig,
  options?: PrepareIsolatedCodexRuntimeOptions,
): NodeJS.ProcessEnv {
  const isolatedCodexRuntime = prepareIsolatedCodexRuntime(userDataPath, gateway, options)

  return {
    ...process.env,
    CODEX_HOME: isolatedCodexRuntime.codexHomePath,
    HOME: isolatedCodexRuntime.codexProcessHomePath,
    ...(gateway?.mcpBearerToken
      ? { [ORBYT_GATEWAY_TOKEN_ENV]: gateway.mcpBearerToken }
      : {}),
  }
}
