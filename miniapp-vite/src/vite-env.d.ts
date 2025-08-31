/// <reference types="vite/client" />

interface ImportMetaViteRsc {
  loadModule<T = any>(env: string, id: string): Promise<T>
  loadBootstrapScriptContent(id: string): Promise<string>
}

declare global {
  interface ImportMeta {
    readonly viteRsc: ImportMetaViteRsc
  }
}