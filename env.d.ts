/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPERSET_URL?: string
  readonly VITE_VENAPCE_API_URL?: string
  readonly VITE_VENAPCE_VERSION?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
