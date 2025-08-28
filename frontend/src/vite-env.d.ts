/// <reference types="vite/client" />

// @vitejs/plugin-rsc types
declare namespace ImportMeta {
  interface ViteRsc {
    loadBootstrapScriptContent(name: string): Promise<string>;
    loadModule<T = any>(env: string, name: string): Promise<T>;
  }
  
  const viteRsc: ViteRsc;
}
