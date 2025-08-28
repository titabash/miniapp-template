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
- **Server Functions**: Next.js Server Actions (外部API統合基盤)
- **Database**: PocketBase 統合済み

## プロジェクト構造

```
project/
├── app/              # Next.js App Router（ルート階層）
│   ├── layout.tsx    # ルートレイアウト + 認証統合
│   ├── page.tsx      # ルート（"/"）→ "/home"リダイレクト
│   ├── home/
│   │   └── page.tsx  # メインページ（"/home"）
│   ├── globals.css   # グローバルCSS + Tailwind
│   └── providers/    # 認証プロバイダー
├── docs/             # 詳細ドキュメント
│   ├── protected-files.md    # 変更不可ファイル一覧
│   ├── DEVELOPMENT_RULES.md  # 開発ルール
│   ├── AUTH_RULES.md         # 認証システム詳細
│   └── その他ガイド
├── pages/            # Pages Router無効化用
│   └── README.md
└── src/              # Feature Sliced Design 構造
    ├── app/          # グローバル設定・プロバイダー
    ├── pages/        # ページコンポーネント
    ├── features/     # 機能単位（認証システム等）
    ├── entities/     # ドメインモデル・型定義
    └── shared/       # 共通リソース
        ├── lib/      # PocketBase等クライアントライブラリ
        ├── server/   # Server Actions（外部API統合）
        └── ui/       # shadcn/ui コンポーネント
```

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド（メインコマンド）
npm run build

# 本番サーバー起動
npm run start

# TypeScript型チェック
npm run type-check

# ESLintチェック
npm run lint
```

## 重要な機能・実装

### 1. 認証システム

- **postMessage連携**: iframe環境での認証情報受信
- **PocketBase統合**: `@/shared/lib/pocketbase` 経由のデータベース接続
- **永続化**: LocalStorage + Cookie の二重永続化
- **自動トークンリフレッシュ**: セッション管理の自動化

### 2. Server Actions（外部API統合基盤）

```typescript
// AI Services例
import { generateImageAction } from "@/shared/server/actions/ai";
import { createChatCompletionAction } from "@/shared/server/actions/openai";

// Database Operations例
import { getRecordsAction, createRecordAction } from "@/shared/server/actions/pocketbase";
```

### 3. ルーティング

- **App Router**: ファイルベースルーティング採用
- **FSD統合**: app/ から src/pages/ のコンポーネントをインポート
- **自動リダイレクト**: "/" → "/home" で一貫性を保持

### 4. UI/UX

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
# 外部API（プロジェクトに応じて設定）
OPENAI_API_KEY=your_openai_key
FAL_KEY=your_fal_key

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

1. **PocketBase**: 必ず `@/shared/lib/pocketbase` の `pb` インスタンスのみ使用
2. **Server Actions**: 外部API機能は `src/shared/server/actions/` 内に実装
3. **FSD準拠**: Feature Sliced Design の階層構造を維持
4. **コンポーネント**: 新しいUIコンポーネントは shadcn/ui を優先使用

## テンプレートの特徴

### 含まれる機能
- ✅ **認証システム**: iframe対応 + PocketBase統合
- ✅ **UI基盤**: shadcn/ui + Tailwind CSS
- ✅ **外部API統合**: Server Actions による統合基盤
- ✅ **型安全性**: TypeScript完全対応
- ✅ **開発体験**: ESLint + 型チェック + ビルド最適化

### 拡張可能な部分
- ページ・コンポーネントの追加
- 外部APIサービスの追加（Server Actions経由）
- UIコンポーネントの追加・カスタマイズ
- ビジネスロジックの実装

## 利用可能なUI コンポーネント

現在インストール済み（shadcn/ui）:
- Alert, Badge, Button, Card, NavigationMenu, Separator

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