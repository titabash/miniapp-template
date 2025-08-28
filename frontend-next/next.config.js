/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pages Routerを無効化（App Routerのみ使用）
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // 実験的機能
  experimental: {
    // パッケージインポートの最適化
    optimizePackageImports: ['@/shared/ui', '@/shared/lib'],
  },
  
  // TypeScript設定
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint設定
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // 環境変数（プロジェクト固有のものを追加）
  env: {
    // テンプレート利用時に必要な環境変数をここに追加
  },
}

export default nextConfig