/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STANDALONE_WS_URL?: string
  readonly VITE_STANDALONE_WS_AUTH_TOKEN?: string
  readonly VITE_STANDALONE_APP_VERSION?: string
  readonly VITE_STANDALONE_PLATFORM?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
