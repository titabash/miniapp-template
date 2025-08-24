# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

React + AI Agent を組み合わせたミニアプリケーション開発テンプレート。フロントエンドとAIエージェントAPIサーバーの2つのコンポーネントで構成される。

## 技術スタック

- **Frontend**: React 19 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **AI Agent**: Claude Code executor with HTTP API server
- **Architecture**: Feature Sliced Design (FSD)

## コマンド一覧

### フロントエンド開発（`frontend/`）
```bash
# 本番ビルド（メインコマンド）
npm run build

# 開発時の自動リビルド
npm run build:watch

# TypeScript型チェック
npm run tsc

# ESLintチェック
npm run lint

# プレビューサーバー起動
npm run preview

# 🚨 禁止: npm run dev（開発サーバー無効）
```

### AIエージェントAPI（`agent/`）
```bash
# サーバー起動（本番）
npm start

# 開発モード（自動再起動）
npm run dev
```

### 全体起動（推奨開発フロー）
```bash
# 1. Agent API起動
cd agent && npm run dev

# 2. Frontend開発（別ターミナル）
cd frontend && npm run build:watch
```

## プロジェクト構成

```
/
├── frontend/           # React フロントエンド
│   ├── src/
│   │   ├── app/       # ルーティング・グローバル状態
│   │   ├── shared/    # 共通コンポーネント・ライブラリ
│   │   ├── entities/  # ドメインモデル層
│   │   ├── features/  # 機能単位のSlice群
│   │   └── pages/     # 画面コンポーネント
│   └── docs/          # 詳細な開発ルール
└── agent/             # AI エージェント API サーバー
    ├── server.ts      # HTTP API サーバー（Agent実行制御）
    └── src/
        ├── agents/    # Claude Code executor
        ├── core/      # Agent factory, database, types
        └── const/     # LLM価格設定等
```

## 重要な制約・ルール

### 🚨 変更禁止ファイル
- `frontend/src/App.tsx` - 認証フロー管理（変更厳禁）
- `frontend/src/main.tsx` - エントリーポイント（変更厳禁）
- `frontend/src/shared/lib/pocketbase.ts` - PocketBase接続設定（変更厳禁）

### PocketBase 必須ルール
- **🚨 MUST USE ONLY** `frontend/src/shared/lib/pocketbase.ts` for ALL PocketBase interactions
- **🚨 NEVER** import PocketBase directly - Always use: `import { pb } from "@/shared/lib/pocketbase"`
- **🚨 NEVER** create new PocketBase instances - Use only the existing singleton
- 認証状態は自動維持・認証ヘッダー自動付与される

### 開発制約
- **禁止**: `npm run dev`（フロントエンド開発サーバー使用不可）
- **必須**: `npm run build`で常にビルドが通ることを確認
- **優先**: エラー解決を最優先で対応

## アーキテクチャ原則

### Feature Sliced Design (FSD)
- **Layers**: app → pages → features → entities → shared
- **Segments**: api, model, ui within each layer
- DDDに基づくドメインモデル設計（service, usecase, entity）

### PocketBase 認証システム
- iframe経由で親アプリから認証情報を受信
- LocalStorage + Cookie の二重永続化
- 自動トークンリフレッシュ（10分間隔）
- 全API呼び出しで認証ヘッダー自動付与

### 開発プロセス
1. データベース設計・テーブル作成
2. TypeScriptモデル型定義
3. PocketBase通信実装（`pb`インスタンス使用）
4. ビジネスロジック実装
5. UIコンポーネント実装（レスポンシブ対応）

## エラーハンドリング

```typescript
// PocketBase接続エラーの適切な処理
try {
  const result = await pb.collection('users').getList();
} catch (error: any) {
  if (error.isAbort) {
    return; // リクエストキャンセルは無視
  }
  console.error('PocketBase Error:', error.status, error.response);
}
```

## Path Aliases（フロントエンド）

- `@/*` → `./src/*`
- `@/shared` → `./src/shared`
- `@/app` → `./src/app`
- `@/pages` → `./src/pages`
- `@/features` → `./src/features`
- `@/entities` → `./src/entities`

## 利用可能なUI コンポーネント

現在インストール済み（shadcn/ui）:
- Alert, Badge, Button, Card, NavigationMenu, Separator

追加時:
```bash
npx shadcn@latest add <component-name> --overwrite
```

## Agent API Architecture

### HTTP エンドポイント
- `GET /health` - ヘルスチェック
- `POST /execute/agent` - Agent実行（Claude Code executor呼び出し）

### Agent実行フロー
1. HTTP API経由でAgent実行リクエスト受信
2. `agent-factory.ts`で適切なAgent（現在はclaude-code）を取得
3. `executeDevelopmentCycle`でClaude Code実行
4. 結果をHTTPレスポンスで返却

### 実行環境
- Port: 3001（デフォルト）
- タイムアウト: 5分
- 環境変数: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`必須

## 詳細ドキュメント

- `frontend/docs/DEVELOPMENT_RULES.md` - 詳細開発ルール
- `frontend/docs/DESIGN_LAYOUT_RULES.md` - デザイン・レイアウト規則  
- `frontend/docs/AUTH_RULES.md` - 認証ルール
- `frontend/docs/REACT_RULES.md` - React実装ルール