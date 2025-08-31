import { defineConfig } from "vite";
import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import checker from "vite-plugin-checker";

// https://vite.dev/config/
export default defineConfig({
  // NEXT_PUBLIC_プレフィックスを受け入れる（Next.jsと統一）
  envPrefix: 'NEXT_PUBLIC_',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      protocol: process.env.HMR_HOST ? "wss" : "ws",
      host: process.env.HMR_HOST || "localhost",
      port: 5173,
      clientPort: 5173,
    },
  },
  preview: {
    port: 8080,
  },
  plugins: [
    rsc({
      // 公式パターン: entriesオプションを使わずrollupOptions.inputで指定
    }),
    // React plugin for client component HMR
    react(),
    tailwindcss(),
    checker({
      typescript: true,
    }),
  ],
  
  // 公式パターン: 各環境のエントリーポイントをrollupOptions.inputで指定
  environments: {
    // RSC環境: react-server条件でモジュールをロード
    // RSCストリームのシリアライゼーションとサーバー関数処理を担当
    rsc: {
      build: {
        rollupOptions: {
          input: {
            index: './src/entry.rsc.tsx',
          },
        },
      },
    },
    
    // SSR環境: react-server条件なしでモジュールをロード  
    // RSCストリームのデシリアライゼーションと従来のSSRを担当
    ssr: {
      build: {
        rollupOptions: {
          input: {
            index: './src/entry.ssr.tsx',
          },
        },
      },
    },
    
    // Client環境: ハイドレーションとクライアントサイドレンダリングを担当
    // RSCストリームのデシリアライゼーション、CSR、RSCリフェッチ、サーバー関数呼び出しを担当
    client: {
      build: {
        rollupOptions: {
          input: {
            index: './src/entry.browser.tsx',
          },
        },
      },
    },
  },
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
