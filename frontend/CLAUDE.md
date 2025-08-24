# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mini-application development environment based on React + Vite + TypeScript.

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **UI Library**: ShadCN UI (New York style) + Tailwind CSS 4
- **Backend**: PocketBase
- **Icons**: Lucide React
- **Linter**: ESLint (TypeScript support)

## Development Commands

```bash
# Build for production (main command)
npm run build

# Build with auto-rebuild (for development)
npm run build:watch

# Run linter
npm run lint

# Start preview server
npm run preview

# PROHIBITED: npm run dev (development server disabled)
```

## Project Structure

Based on Feature Sliced Design (FSD) architecture:

```
src/
├── app/           # ルーティング・グローバル State
├── shared/        # 共通コンポーネントとライブラリ
│   ├── ui/        # shadcn/ui基本UIコンポーネント
│   └── lib/       # pocketbase.ts、utils.ts など
├── entities/      # ドメインモデル層
├── features/      # 機能単位のSlice群（auth など）
├── pages/         # 画面コンポーネント
├── assets/        # 静的ファイル（images, icons など）
├── App.tsx        # メインコンポーネント（変更禁止）
└── main.tsx       # エントリーポイント（変更禁止）
```

### 使用可能なshadcn/uiコンポーネント

現在インストール済み：
- `Alert` - アラート表示
- `Badge` - バッジ
- `Button` - ボタン
- `Card` - カード
- `NavigationMenu` - ナビゲーション
- `Separator` - 区切り線

追加コンポーネントが必要な場合：
```bash
npx shadcn@latest add <component-name> --overwrite
```

## Path Aliases

- `@/*` → `./src/*`
- `@/shared` → `./src/shared`
- `@/shared/ui` → `./src/shared/ui`
- `@/shared/lib` → `./src/shared/lib`
- `@/app` → `./src/app`
- `@/pages` → `./src/pages`
- `@/features` → `./src/features`
- `@/entities` → `./src/entities`

## Development Environment

- **Port**: 5173 (fixed)
- **Host**: 0.0.0.0 (Docker compatible)
- **HMR**: Enabled
- **TypeScript**: Strict mode

## ShadCN UI Configuration

- **Style**: New York
- **Base Color**: Neutral
- **CSS Variables**: Enabled
- **TypeScript**: Supported
- **RSC**: Disabled

## Coding Standards

- TypeScript strict mode
- Follow ESLint configuration
- Adhere to React Hooks rules
- Use ShadCN UI components when possible

## Database and Authentication

- **Database**: PocketBase (primary database solution)
- **Authentication**: PocketBase Auth (built-in user management with automatic persistence)
- Uses PocketBase SDK (`pocketbase@0.26.1`)
- Real-time database integration supported
- Built-in admin dashboard available

### PocketBase Authentication Architecture

**認証状態の完全な永続化と自動維持**:
- **LocalStorage + Cookie**: 二重の永続化メカニズムによりページリロード後も認証状態が復元
- **自動トークンリフレッシュ**: 10分ごとに自動的にトークンを更新し、セッションを延長
- **認証ヘッダー自動付与**: 全てのAPI呼び出しに認証トークンが自動適用される
- **認証状態自動検証**: `authStore.isValid`により期限切れトークンを自動検出

**認証フロー**:
1. `App.tsx`で認証成功 → `authStore`に認証情報保存
2. `LocalStorage`と`Cookie`に認証状態が永続保存
3. `AppRouter`以降の全てのコンポーネントで認証状態が自動維持
4. 全ての`pb.collection()` API呼び出しで認証が自動適用

### PocketBase Features to Leverage

- **Real-time Subscriptions**: Use `pb.collection().subscribe()` for live data updates
- **File Storage**: Built-in file upload and management capabilities
- **Relations**: Use expand parameter to fetch related records efficiently
- **Advanced Filtering**: Utilize complex filter expressions and full-text search
- **Batch Operations**: Perform multiple database operations efficiently
- **Custom Validation**: Server-side validation rules and hooks
- **API Rules**: Fine-grained access control for collections
- **Backup & Migration**: Built-in data backup and schema migration tools

## Important Development Constraints

### 🚨 Critical Rules - DO NOT VIOLATE

1. **PocketBase Integration - MANDATORY USAGE**
   - **🚨 MUST USE ONLY `src/shared/lib/pocketbase.ts` for ALL PocketBase interactions** - This is STRICTLY ENFORCED
   - **🚨 NEVER modify `src/shared/lib/pocketbase.ts`** - This file is read-only and must not be changed under any circumstances
   - **🚨 NEVER import PocketBase directly** - Always use the provided `pb` instance: `import { pb } from "@/shared/lib/pocketbase"`
   - **🚨 NEVER create new PocketBase instances** - Use only the existing singleton `pb` instance
   - **認証状態の自動維持**: 単一の`pb`インスタンスにより認証状態が自動的に全アプリで共有される
   - **使用例**: `await pb.collection('users').getList()`, `pb.collection('posts').subscribe('*', callback)`
   - **Leverage PocketBase's full feature set**: Real-time subscriptions, file uploads, authentication, relations, filters, sorting
   - Follow PocketBase API documentation: https://pocketbase.io/docs/api-records/
   - Utilize advanced features: Real-time updates, batch operations, expand relations, custom queries

2. **Authentication System**
   - This app uses a special authentication mechanism
   - Authentication info is received from the parent app via iframe
   - **NEVER modify `App.tsx`** - This file handles the authentication flow
   - **認証状態は自動維持**: `App.tsx`で認証が通れば、`AppRouter`以降で認証状態が完全に維持される
   - **PocketBase通信の自動認証**: 全ての`pb.collection()`呼び出しで認証ヘッダーが自動付与される
   - **手動認証処理不要**: 認証トークンの管理、リフレッシュ、ヘッダー設定は全て自動化
   - Always implement apps requiring user authentication

3. **Development Workflow**
   - **NEVER run `npm run dev`** - Development server is prohibited
   - Use `npm run build` to verify builds pass
   - Use `npm run build:watch` for development with auto-rebuild
   - Fix any build errors immediately

4. **UI Components**
   - Use shadcn/ui components when possible
   - Add new components with: `npx shadcn@latest add <component-name>`
   - Maintain responsive design patterns

5. **PocketBase Configuration**
   - Configure API Rules properly for SuperUser access
   - Set appropriate permissions for application requirements
   - Use MCP to configure PocketBase settings when needed

## Architecture Principles

### Feature Sliced Design (FSD)
- **Segments**: api, model, ui within each layer
- **Layers**: app → pages → features → entities → shared
- **Domain models**: Implement service and usecase within model segment following DDD principles
- **Common code**: Place reusable code in lower layers for proper sharing

### Development Process
1. **Database Design**: Create tables using MCP with proper API Rules
2. **Model Implementation**: Define TypeScript types based on database schema
3. **Database Communication**: Implement CRUD operations using `import { pb } from "@/shared/lib/pocketbase"`
4. **Business Logic**: Implement application-specific logic and validation
5. **View Implementation**: Create UI components with responsive design

### PocketBase Communication Guidelines

**✅ 正しい使用方法**:
```typescript
// 必ず統一されたpbインスタンスを使用
import { pb } from "@/shared/lib/pocketbase";

// 認証が自動適用されたAPI呼び出し
const users = await pb.collection('users').getList();
const user = await pb.collection('users').getOne(id);
await pb.collection('posts').create({ title: 'Hello' });

// リアルタイム購読
pb.collection('messages').subscribe('*', (e) => {
  console.log(e.action, e.record);
});
```

**❌ 禁止事項**:
```typescript
// ❌ PocketBaseを直接インポートしない
import PocketBase from 'pocketbase';

// ❌ 新しいインスタンスを作成しない
const newPb = new PocketBase('...');

// ❌ 手動で認証ヘッダーを設定しない（自動化されているため）
pb.beforeSend = (url, options) => {
  options.headers['Authorization'] = '...'; // 不要
};
```

### Error Handling
```typescript
// PocketBase接続エラーの適切な処理
try {
  const result = await pb.collection('users').getList();
} catch (error: any) {
  if (error.isAbort) {
    // リクエストがキャンセルされた場合は無視
    return;
  }
  
  console.error('PocketBase Error:', error.status, error.response);
  // エラーハンドリング処理
}
```

- Handle PocketBase aborted requests (err.isAbort) by ignoring them
- Output both error messages and details for debugging
- Prioritize error resolution above all else
- 認証エラー（401/403）は自動的にログアウト処理される

### Development Guidelines

- Prioritize error resolution above all else
- Implement minimum viable features to meet user requirements
- Maintain existing architecture and styling patterns
- Follow Modern React (React 18+) with TypeScript best practices
- **Maximize PocketBase feature utilization** - Always consider real-time updates, relations, and advanced filtering before implementing custom solutions
- **認証状態を信頼する**: `App.tsx`認証通過後は、全てのPocketBase通信で認証が保証される

### 🚨 変更禁止ファイル - 絶対に編集しない

1. **`App.tsx`** - 認証フローを管理する（変更厳禁）
2. **`main.tsx`** - エントリーポイント（変更厳禁）
3. **`src/shared/lib/pocketbase.ts`** - PocketBase接続設定（変更厳禁）

これらのファイルを変更するとアプリケーションが機能しなくなります。

### 🎯 開発スタイル

- エラー解決を最優先
- 必要最小限の実装で迅速に機能を完成
- 既存のアーキテクチャとスタイリングパターンを維持
- 新規作成時は`src`以下の既存サンプルコードを完全に置き換え（指定ファイル除く）
