# ルーティングルール

このドキュメントでは、Next.js App Router + Feature Sliced Design (FSD) 構成でのルーティング実装方法を説明します。

## アーキテクチャ概要

本プロジェクトは以下の2層構成で動作します：

- **`app/`** - Next.js App Routerの公式ルーティング層
- **`src/pages/`** - FSDに準拠したページコンポーネント実装層

## ページ追加の手順

新しいページを追加する際は、以下の手順を**必ず両方**実行してください：

### 1. ページコンポーネントの作成

`src/pages/` にページコンポーネントを作成します。

```typescript
// src/pages/AboutPage.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function AboutPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <p>このページについて...</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 2. App Routerルートの作成

`app/` にディレクトリとpage.tsxを作成し、作成したページコンポーネントをインポートします。

```typescript
// app/about/page.tsx
import { AboutPage } from "@/pages/AboutPage";

export default function About() {
  return <AboutPage />;
}
```

## 具体的な例

### 例1: 基本的なページ

| URL        | ディレクトリ構造                                     |
| ---------- | ---------------------------------------------------- |
| `/about`   | `app/about/page.tsx` → `src/pages/AboutPage.tsx`     |
| `/contact` | `app/contact/page.tsx` → `src/pages/ContactPage.tsx` |

### 例2: 階層化されたページ

| URL                 | ディレクトリ構造                                                      |
| ------------------- | --------------------------------------------------------------------- |
| `/profile/settings` | `app/profile/settings/page.tsx` → `src/pages/ProfileSettingsPage.tsx` |
| `/admin/users`      | `app/admin/users/page.tsx` → `src/pages/AdminUsersPage.tsx`           |

### 例3: 動的ルート

| URL           | ディレクトリ構造                                           |
| ------------- | ---------------------------------------------------------- |
| `/users/[id]` | `app/users/[id]/page.tsx` → `src/pages/UserDetailPage.tsx` |

```typescript
// app/users/[id]/page.tsx
import { UserDetailPage } from "@/pages/UserDetailPage";

interface Props {
  params: { id: string };
}

export default function UserDetail({ params }: Props) {
  return <UserDetailPage userId={params.id} />;
}
```

```typescript
// src/pages/UserDetailPage.tsx
interface UserDetailPageProps {
  userId: string;
}

export function UserDetailPage({ userId }: UserDetailPageProps) {
  return (
    <div>
      <h1>User ID: {userId}</h1>
      {/* ユーザー詳細の実装 */}
    </div>
  );
}
```

## 命名規則

### ページコンポーネント (`src/pages/`)

- **ファイル名**: `PascalCase` + `Page.tsx`
- **コンポーネント名**: ファイル名と同じ
- **例**: `HomePage.tsx`, `UserDetailPage.tsx`, `ProfileSettingsPage.tsx`

### App Router (`app/`)

- **ディレクトリ名**: `kebab-case`
- **ファイル名**: 常に `page.tsx`
- **コンポーネント名**: URLに基づいたPascalCase
- **例**: `app/about/page.tsx` → `About()`, `app/user-profile/page.tsx` → `UserProfile()`

## 重要な注意点

### ✅ 正しい実装パターン

```typescript
// app/settings/page.tsx
import { SettingsPage } from "@/pages/SettingsPage";

export default function Settings() {
  return <SettingsPage />;
}
```

### ❌ 避けるべきパターン

```typescript
// app/settings/page.tsx - 直接実装はNG
export default function Settings() {
  return <div>設定画面の直接実装 < /div>; / / FSD違反
}
```

### ❌ 片方だけの実装はNG

- `src/pages/AboutPage.tsx` だけ作成して `app/about/page.tsx` を作らない
- `app/about/page.tsx` だけ作成して `src/pages/AboutPage.tsx` を作らない

## メタデータの設定

Next.js App Routerのメタデータは `app/` 層で設定します：

```typescript
// app/about/page.tsx
import { Metadata } from "next";
import { AboutPage } from "@/pages/AboutPage";

export const metadata: Metadata = {
  title: "About | My App",
  description: "私たちについて",
};

export default function About() {
  return <AboutPage />;
}
```

## 既存のルート構成

現在設定済みのルート：

- `/` → `HomePage` コンポーネントを直接表示 (`app/page.tsx`)
  - 未認証時: `AuthProvider` により自動的に `LoginForm` を表示
  - 認証済み: `HomePage` を表示

## 参考リンク

- [Next.js App Router - Routing](https://nextjs.org/docs/app/building-your-application/routing)
- [Feature Sliced Design - Pages Layer](https://feature-sliced.design/docs/reference/layers#pages)
