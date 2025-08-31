# 開発ルール・ガイドライン

## 技術スタック・アーキテクチャ

### 基本構成
- **React**: React 18+ with TypeScript
- **ビルドツール**: Vite
- **スタイリング**: TailwindCSS
- **UIライブラリ**: shadcn/ui + Magic UI
- **データベース**: PocketBase
- **アーキテクチャ**: Feature Sliced Design (FSD)

### フォルダ構造（FSD準拠）
```
miniapp-next/
├─ src/
│  ├─ app/          # ルーティング・グローバル State
│  ├─ shared/
│  │  ├─ ui/        # 共通UIコンポーネント（shadcn/ui）
│  │  ├─ lib/       # 汎用ユーティリティ（utils, pocketbase等）
│  │  └─ server/    # 外部APIクライアント（*.server.ts）
│  ├─ entities/     # ドメインモデル層
│  │  └─ [entity]/  # 各エンティティ（user, post等）
│  │     ├─ api/    # エンティティ固有のServer Actions
│  │     ├─ model/  # 型定義・バリデーション
│  │     └─ lib/    # エンティティ固有のユーティリティ
│  ├─ features/     # 機能単位のSlice群
│  │  └─ [feature]/ # 各機能（chat, image-generation等）
│  │     ├─ api/    # 機能固有のServer Actions
│  │     ├─ model/  # 機能固有の状態管理
│  │     └─ ui/     # 機能固有のコンポーネント
│  └─ pages/        # 画面コンポーネント
│     └─ [page]/    # 各ページ
│        ├─ ui/     # ページコンポーネント
│        └─ model/  # ページ固有の状態管理
```

### アーキテクチャ原則

#### **Feature Sliced Design（FSD）の層構造**
- **Shared**: 純粋な共通リソース（どの機能にも依存しない）
- **Entities**: ドメインモデル・エンティティ（User, Post等の業務概念）
- **Features**: ビジネス機能（Chat, ImageGeneration等の機能）
- **Pages**: 画面コンポーネント（ルーティングに対応する表示層）

#### **Server Actionsの配置ルール**
- **🚨 共通APIクライアント**: `src/shared/server/*.server.ts` のみ
- **✅ エンティティ操作**: `src/entities/[entity]/api/` に配置
- **✅ 機能固有処理**: `src/features/[feature]/api/` に配置
- **❌ sharedに機能固有のServer Action配置は禁止**

#### **開発原則**
- 適切な責務分割を行い実装する
- 一つのファイルに実装をまとめすぎず、適切に責務を分割する
- レスポンシブデザインを実装する
- 使いやすいUXと美しいUIデザインを心がける
- FSDの層構造を遵守し、上位層から下位層への依存のみ許可

## PocketBase データベースルール

### 🚨 必須使用ルール - 厳格遵守
- **🚨 MUST USE ONLY `src/shared/lib/pocketbase.ts` for ALL PocketBase interactions** - This is STRICTLY ENFORCED
- **🚨 NEVER modify `src/shared/lib/pocketbase.ts`** - This file is read-only and must not be changed under any circumstances
- **🚨 NEVER import PocketBase directly** - Always use the provided `pb` instance: `import { pb } from "@/shared/lib/pocketbase"`
- **🚨 NEVER create new PocketBase instances** - Use only the existing singleton `pb` instance

### 基本的な使用方法
- **統一インスタンス**: `import { pb } from "@/shared/lib/pocketbase"`で統一されたインスタンスを使用
- **認証自動適用**: 全ての`pb.collection()`呼び出しで認証ヘッダーが自動付与される
- **永続化機能**: LocalStorage + Cookie の二重永続化により認証状態が自動維持される
- **自動リフレッシュ**: 10分ごとに自動的にトークンを更新
- PocketBaseのAPI仕様：https://pocketbase.io/docs/api-records/
- MCPを使用してPocketBaseを操作する

### 正しい使用例
```typescript
// ✅ 正しい使用方法
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

### 禁止事項
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

### テーブル作成ルール
- Booleanのカラムは適切なデフォルト値を設定する
- Required/Non‑emptyはOFFにする
- API RulesはSuperUser以外が見れるようにMCPで適切に設定する

### エラーハンドリング
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

- PocketBaseへのリクエストについて、Abort(err.isAbort)されたリクエストは無視するように例外処理する
- エラーについてはメッセージだけでなく、詳細も出力する
- 認証エラー（401/403）は自動的にログアウト処理される

### データベース設計手順
1. アプリケーションの要件分析
2. データベース設計
3. PocketBaseの適切な設定
4. pocketbase.tsを活用したデータベース操作の実装

## 認証・セキュリティ

### 認証の仕組み
- このアプリケーションは特殊な認証認可の仕組みを持つ
- iframeで表示され、親アプリから認証情報を受け取る
- 認証処理はApp.tsxで実装済み（🚨 **変更禁止**）
- **認証状態は自動維持**: `App.tsx`で認証が通れば、`AppRouter`以降で認証状態が完全に維持される
- **PocketBase通信の自動認証**: 全ての`pb.collection()`呼び出しで認証ヘッダーが自動付与される
- **手動認証処理不要**: 認証トークンの管理、リフレッシュ、ヘッダー設定は全て自動化
- アプリの仕様に関わらず、原則ユーザ認証が必要なアプリとして実装する

### 認証フロー
1. `App.tsx`で認証成功 → `authStore`に認証情報保存
2. `LocalStorage`と`Cookie`に認証状態が永続保存
3. `AppRouter`以降の全てのコンポーネントで認証状態が自動維持
4. 全ての`pb.collection()` API呼び出しで認証が自動適用

### 永続化メカニズム
- **LocalStorage + Cookie**: 二重の永続化メカニズムによりページリロード後も認証状態が復元
- **自動トークンリフレッシュ**: 10分ごとに自動的にトークンを更新し、セッションを延長
- **認証ヘッダー自動付与**: 全てのAPI呼び出しに認証トークンが自動適用される
- **認証状態自動検証**: `authStore.isValid`により期限切れトークンを自動検出

## UIコンポーネント

### 利用可能なライブラリ
- **shadcn/ui**: 基本的なUIコンポーネント
- **Magic UI**: 追加のUIコンポーネント
- **Lucide React**: アイコン
- MCPで必要なコンポーネントを確認・取得可能

### デザインシステム
- 詳細なレイアウトルールは`docs/DESIGN_LAYOUT_RULE.md`を参照
- レスポンシブデザインを必ず実装する
- アクセシビリティを考慮する

## 実装プロセス

### 開発フロー

#### 0. アーキテクチャ設計
- アプリケーション全体のアーキテクチャを設計する
- 必要な画面・機能・コンポーネントの洗い出し
- ユーザーフローの整理
- データフローの設計

#### 実装順序
1. **データベース設定**
   - MCPを利用したテーブル作成
   - API Rulesの適切な設定
   - テーブル間のリレーション設定

2. **DBモデルを踏まえたモデルの実装**
   - TypeScriptでのモデル型定義
   - データ構造の明確化

3. **DBとの通信部分の実装**
   - `import { pb } from "@/shared/lib/pocketbase"`を使用
   - CRUD操作の実装
   - エラーハンドリングの実装

4. **ビジネスロジック**
   - アプリケーション固有のロジック実装
   - データ操作・変換処理
   - バリデーション処理

5. **ビューの実装**
   - UIコンポーネントの実装
   - レスポンシブデザインの適用
   - ユーザーインタラクションの実装

#### 各段階での注意点
- エラー発生時は解決を最優先
- 必要最低限の実装で迅速に開発
- ステップバイステップで実装
- 各段階でビルドエラーが出ないことを確認

### ビルド・テスト
- `npm run build`でビルドが通ることを確認
- コードの品質を担保する

### 新規作成時の注意
- `src`以下の既存コードはサンプル
- ユーザー要求に合わせて完全に置き換える
- 古いコード・不要なコードは一切残さない（指定されたファイルを除く）

## 外部リソース

### 参考ドキュメント
- [PocketBase API Documentation](https://pocketbase.io/docs/api-records/)
- [docs/DESIGN_LAYOUT_RULE.md](./DESIGN_LAYOUT_RULE.md) - レイアウト・デザインルール

### MCPツール
- PocketBase操作
- shadcn/ui・Magic UIコンポーネントの確認・取得
