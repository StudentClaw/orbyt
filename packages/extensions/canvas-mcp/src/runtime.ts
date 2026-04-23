import { CanvasAuthError } from "@orbyt/contracts"

export type CanvasPluginCredentials = {
  baseUrl: string
  token: string
}

export type CanvasCredentialMessage = {
  type: "plugin.credentials"
  pluginId: "canvas-mcp"
  payload: CanvasPluginCredentials
}

export class CanvasCredentialStore {
  #credentials?: CanvasPluginCredentials

  setCredentials(credentials: CanvasPluginCredentials): void {
    this.#credentials = {
      baseUrl: credentials.baseUrl.trim(),
      token: credentials.token.trim(),
    }
  }

  getCredentials(): CanvasPluginCredentials | undefined {
    return this.#credentials
  }

  requireCredentials(): CanvasPluginCredentials {
    if (!this.#credentials?.baseUrl || !this.#credentials.token) {
      throw new CanvasAuthError({
        message: "Canvas credentials have not been provided to the plugin runtime yet.",
      })
    }

    return this.#credentials
  }
}
