# CLAUDE.md - Next.js Application Template

This file provides guidance to Claude Code when working with this Next.js application template.

## プロジェクト概要

Next.js 15 + React 19 + TypeScript を基盤とした現代的なWebアプリケーション開発テンプレート。
Feature Sliced Design（FSD）アーキテクチャを採用し、拡張性と保守性を重視した構成。

## 技術スタック

- **Frontend**: Next.js 15 + React 19 + TypeScript + App Router
- **UI**: shadcn/ui + Tailwind CSS 3.4
- **Architecture**: Feature Sliced Design (FSD)
- **Authentication**: PostMessage + PocketBase (iframe対応)
- **AI Integration**: Mastra (AI Agent Framework) + AI SDK + Anthropic Claude Code
- **AI Services**: fal.ai (画像・動画生成・音声認識) + OpenAI API
- **Server Functions**: Next.js Server Actions (外部API統合基盤)
- **Database**: PocketBase（クライアントサイド基本 + Server Functions対応）
- **Validation**: Zod (型安全なスキーマバリデーション)

## プロジェクト構造

```
miniapp-next/
├── app/              # Next.js App Router（ルート階層）
│   ├── layout.tsx    # ルートレイアウト + 認証統合
│   ├── page.tsx      # ルート（"/"）→ "/home"リダイレクト
│   ├── home/
│   │   └── page.tsx  # メインページ（"/home"）
│   ├── globals.css   # グローバルCSS + Tailwind
│   └── providers/    # 認証プロバイダー
│       ├── auth-provider.tsx
│       └── index.tsx
├── docs/             # 詳細ドキュメント
│   ├── protected-files.md         # 変更不可ファイル一覧
│   ├── DEVELOPMENT_RULES.md       # 開発ルール
│   ├── FSD_ARCHITECTURE_GUIDE.md  # Feature Sliced Design アーキテクチャガイド
│   ├── AUTH_RULES.md              # 認証システム詳細
│   ├── DESIGN_LAYOUT_RULES.md     # デザイン・レイアウトルール
│   ├── REACT_RULES.md             # React実装ルール
│   ├── ROUTING_RULES.md           # ルーティングルール
│   ├── SERVER_FUNCTIONS_GUIDE.md  # Server Functions ガイド
│   └── AI_AGENT_DEVELOPMENT_GUIDE.md  # AI Agent開発ガイド
├── pages/            # Pages Router無効化用（.gitkeepのみ）
│   └── .gitkeep
├── components.json   # shadcn/ui設定ファイル
└── src/              # Feature Sliced Design 構造
    ├── app/          # グローバル設定・プロバイダー
    ├── assets/       # 静的リソース
    │   └── react.svg
    ├── pages/        # ページコンポーネント
    │   ├── HomePage/ # メインページ（FSD準拠構造）
    │   └── index.ts
    ├── features/     # 機能単位（認証システム等）
    │   └── auth/     # 認証機能
    │       ├── model/
    │       └── index.ts
    ├── entities/     # ドメインモデル・型定義
    │   └── user/     # ユーザーエンティティ
    └── shared/       # 共通リソース
        ├── lib/      # ユーティリティ・クライアントライブラリ
        │   ├── pocketbase.ts  # PocketBase統合
        │   ├── utils.ts       # 汎用ユーティリティ
        │   └── variants.ts    # バリアント設定
        └── server/   # 外部APIクライアント（共通ライブラリ）
            ├── fal.server.ts          # fal.ai APIクライアント
            ├── openai.server.ts       # OpenAI APIクライアント
            └── pocketbase.server.ts   # PocketBase Server Functions用
        └── ui/       # shadcn/ui コンポーネント
            ├── alert.tsx
            ├── badge.tsx
            ├── button.tsx
            ├── card.tsx
            ├── navigation-menu.tsx
            └── separator.tsx
```

## 開発コマンド

```bash
# 開発サーバー起動（ポート5173）
npm run dev

# 本番ビルド（メインコマンド）
npm run build

# ビルド監視モード（開発時の自動リビルド）
npm run build:watch

# 本番サーバー起動（ポート8080）
npm run start

# プレビューサーバー（ポート8080）
npm run preview

# TypeScript型チェック
npm run tsc

# ESLintチェック
npm run lint
```

## 重要な機能・実装

### 1. 認証システム

- **postMessage連携**: iframe環境での認証情報受信
- **PocketBase統合**:
  - 基本: クライアントサイド（`@/shared/lib/pocketbase`）
  - 特定用途: Server Functions（`@/shared/server/pocketbase.server`）
- **永続化**: LocalStorage + Cookie の二重永続化
- **自動トークンリフレッシュ**: セッション管理の自動化

### 2. AI統合機能（新機能）

#### fal.ai統合（画像・動画・音声生成）
**FSD準拠の実装例**：
```typescript
// 1. 共通ライブラリを利用したServer Action作成
// src/features/image-generation/api/generateImage.ts
"use server";
import { generateImage } from "@/shared/server/fal.server";

export async function generateImageAction(prompt: string, options?: ImageOptions) {
  return await generateImage(prompt, options);
}

// 2. フロントエンドからの利用
// 🚨 注意: 実際の利用には entry.rsc.tsx への登録が必要
import { generateImageAction } from "@/features/image-generation/api/generateImage";
const result = await generateImageAction("Beautiful sunset landscape");
```

#### OpenAI API統合
**FSD準拠の実装例**：
```typescript
// 1. 共通ライブラリを利用したServer Action作成
// src/features/chat/api/createCompletion.ts
"use server";
import { createOpenAIInstance, OPENAI_CONFIG } from "@/shared/server/openai.server";

export async function createChatCompletionAction(messages: ChatMessage[]) {
  const openai = await createOpenAIInstance();
  return await openai.chat.completions.create({
    ...OPENAI_CONFIG.CHAT_DEFAULTS,
    messages
  });
}
```

#### Mastra AI Agent Framework
- Anthropic Claude Codeとの統合
- AI Agentの開発・実行基盤
- `@anthropic-ai/claude-code` パッケージ使用

### 3. Server Actions（FSD準拠の外部API統合）

**正しい実装パターン**：
```typescript
// 機能固有のServer Actions（FSD準拠）
// src/features/image-generation/api/generateImage.ts
import { generateImage } from "@/shared/server/fal.server"; // 共通ライブラリ利用

// エンティティ固有のServer Actions（FSD準拠）
// src/entities/user/api/getUser.ts
import { pb } from "@/shared/lib/pocketbase"; // クライアントサイド専用

// 詳細な実装方法は docs/SERVER_FUNCTIONS_GUIDE.md を参照
```

### 4. ルーティング

- **App Router**: ファイルベースルーティング採用
- **FSD統合**: app/ から src/pages/ のコンポーネントをインポート
- **自動リダイレクト**: "/" → "/home" で一貫性を保持

### 5. UI/UX

- **shadcn/ui**: 現代的なコンポーネントライブラリ
- **Tailwind CSS**: ユーティリティファーストCSS
- **レスポンシブ**: モバイルファーストデザイン

## Path Aliases（完全保持）

- `@/*` → `./src/*`
- `@/shared` → `./src/shared`
- `@/app` → `./src/app`
- `@/pages` → `./src/pages`
- `@/features` → `./src/features`
- `@/entities` → `./src/entities`

## 環境変数

```bash
# AI Services API Keys
OPENAI_API_KEY=your_openai_key          # OpenAI API（チャット・テキスト生成）
FAL_KEY=your_fal_key                    # fal.ai（画像・動画・音声生成）
ANTHROPIC_API_KEY=your_anthropic_key    # Anthropic Claude API（AI Agent機能）

# PocketBase設定（認証・DB）
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090

# その他のAPI設定をここに追加
```

## 重要な制約・開発ルール

### 🚨 変更不可ファイル（詳細は docs/protected-files.md 参照）

- **`src/shared/lib/pocketbase.ts`** - DB接続設定（変更厳禁）
- **`src/features/auth/`** - 認証システム（機能保持必須）  
- **`src/shared/server/`** - 外部API基盤（拡張推奨、削除注意）

### 基本開発ルール

1. **PocketBase使い分けガイドライン**:

   **クライアントサイド（基本・推奨）** - `@/shared/lib/pocketbase`
   - ユーザー認証が必要な操作
   - リアルタイムサブスクリプション
   - ユーザーコンテキストに依存する操作
   - 通常のCRUD操作

   **Server Functions（特定用途のみ）** - `@/shared/server/pocketbase.server`
   - 管理者権限が必要な操作
   - 機密情報を扱う処理
   - バッチ処理・データ集計
   - 外部APIとの連携が必要な処理
   - MastraのAIエージェント実装
   - サーバーサイドバリデーション

2. **Server Actions**: 外部API機能は `src/shared/server/` 内に実装
3. **FSD準拠**: Feature Sliced Design の階層構造を維持
4. **コンポーネント**: 新しいUIコンポーネントは shadcn/ui を優先使用

## テンプレートの特徴

### 含まれる機能
- ✅ **認証システム**: iframe対応 + PocketBase統合
- ✅ **UI基盤**: shadcn/ui + Tailwind CSS
- ✅ **AI統合**: fal.ai（画像・動画・音声生成）+ OpenAI API
- ✅ **AI Agent**: Mastra Framework + Anthropic Claude Code
- ✅ **外部API統合**: Server Actions による統合基盤
- ✅ **型安全性**: TypeScript + Zod バリデーション完全対応
- ✅ **開発体験**: ESLint + 型チェック + ビルド最適化

### 拡張可能な部分
- ページ・コンポーネントの追加
- AI機能の追加・カスタマイズ（fal.ai、OpenAI等）
- 外部APIサービスの追加（Server Actions経由）
- UIコンポーネントの追加・カスタマイズ
- ビジネスロジックの実装

## 利用可能なUI コンポーネント

現在インストール済み（shadcn/ui）:
- **Alert**: アラート・通知表示コンポーネント
- **Badge**: バッジ・ラベル表示コンポーネント  
- **Button**: ボタンコンポーネント（各種バリアント対応）
- **Card**: カード型レイアウトコンポーネント（Header, Content, Description, Title対応）
- **NavigationMenu**: ナビゲーションメニューコンポーネント
- **Separator**: セパレーター・区切り線コンポーネント

shadcn/ui設定:
- **Style**: new-york
- **Base Color**: neutral  
- **CSS Variables**: 有効
- **RSC**: React Server Components対応

追加時:
```bash
npx shadcn@latest add <component-name>
```

## デプロイメント

```bash
# 本番ビルド
npm run build

# 本番サーバー起動
npm run start
```

## 開始方法

1. **依存関係インストール**: `npm install`
2. **環境変数設定**: `.env.local` に必要なAPI キーを追加
3. **開発サーバー起動**: `npm run dev`
4. **PocketBase設定**: 認証・データベースの設定
5. **カスタマイズ開始**: `src/pages/HomePage.tsx` から実装開始

## 参考リンク・ドキュメント

- **内部ドキュメント**: `docs/` ディレクトリ内の詳細ガイド参照
- [Feature Sliced Design](https://feature-sliced.design/docs)
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)