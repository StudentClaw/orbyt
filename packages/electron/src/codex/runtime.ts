import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export type PluginGatewayLaunchConfig = {
  readonly bridgeUrl: string
  readonly bridgeEventsUrl: string
  readonly bridgeToken: string
  readonly mcpUrl: string
  readonly mcpBearerToken: string
  readonly mcpServerName: string
}

const STUDENT_CLAW_GATEWAY_TOKEN_ENV = "STUDENT_CLAW_GATEWAY_BEARER_TOKEN"

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
    `bearer_token_env_var = ${JSON.stringify(STUDENT_CLAW_GATEWAY_TOKEN_ENV)}`,
    `enabled = true`,
    "",
  ].join("\n")
}

export function prepareIsolatedCodexRuntime(
  userDataPath: string,
  gateway?: PluginGatewayLaunchConfig,
): {
  readonly codexHomePath: string
  readonly codexProcessHomePath: string
} {
  const codexHomePath = path.join(userDataPath, "codex-home")
  const codexProcessHomePath = path.join(userDataPath, "codex-user-home")

  mkdirSync(codexHomePath, { recursive: true })
  mkdirSync(codexProcessHomePath, { recursive: true })
  mkdirSync(path.join(codexProcessHomePath, ".agents", "skills"), { recursive: true })

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
): NodeJS.ProcessEnv {
  const isolatedCodexRuntime = prepareIsolatedCodexRuntime(userDataPath, gateway)

  return {
    ...process.env,
    CODEX_HOME: isolatedCodexRuntime.codexHomePath,
    HOME: isolatedCodexRuntime.codexProcessHomePath,
    ...(gateway?.mcpBearerToken
      ? { [STUDENT_CLAW_GATEWAY_TOKEN_ENV]: gateway.mcpBearerToken }
      : {}),
  }
}
