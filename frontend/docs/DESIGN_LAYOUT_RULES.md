# DESIGN LAYOUT Rule
*shadcn/ui + Tailwind CSS 4 対応版*

## 概要

SNSやコミュニティ系Webサービスにおける現代的なレスポンシブレイアウトの標準パターンを定義したデザインシステムです。**フィード中心の1カラム → 中画面で2カラム → デスクトップで3カラム**という段階的拡張を基本として、shadcn/uiコンポーネントとTailwind CSS 4の新機能を活用した実装アプローチを提供します。

## 技術スタック

- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **UI Framework**: shadcn/ui (New York style)
- **CSS Framework**: Tailwind CSS 4.1.11
- **Design System**: Radix UI Primitives
- **Icons**: Lucide React
- **Database**: PocketBase
- **Authentication**: PocketBase Auth (iframe認証)

## 設計原則

1. **Mobile-First アプローチ**：最小画面から段階的に拡張
2. **Component-Driven**：shadcn/uiの再利用可能コンポーネント活用
3. **UX一貫性**：デバイス間でナビゲーション体験を統一
4. **アクセシビリティ**：Radix UIの標準準拠とタッチ操作対応
5. **Tailwind 4最適化**：新しいコンテナクエリとレイヤー機能の活用
6. **PocketBase統合**：リアルタイム更新とオフライン対応を考慮
7. **FSD準拠**：Feature Sliced Designアーキテクチャに従った実装
8. **iframe認証**：親アプリからの認証情報受信（App.tsx変更禁止）

---

## レイアウトパターン

### 1. Feed-First Single Column + Bottom Navigation
**対象画面幅：< 600px（モバイル）**

#### 構成要素
- **Sticky Top Bar**：検索・通知機能
- **主フィード**：コンテンツ表示領域
- **Bottom Navigation**：3-5の主要機能へのアクセス
- **FAB（Floating Action Button）**：新規投稿

#### 設計根拠
- 親指可動域にトップレベル機能を配置し最速導線を実現
- Material Designガイドラインに準拠（3-5項目が適量）
- モバイルファーストの基本レイアウト

#### shadcn/ui実装例
```tsx
// src/shared/ui/mobile-layout.tsx
import { Button } from "@/shared/ui/button"
import { pb } from "@/shared/lib/pocketbase"
import { Home, Search, Bell, User, Plus } from "lucide-react"
import { useEffect, useState } from "react"

export function MobileLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(pb.authStore.model)
  const [notifications, setNotifications] = useState(0)

  useEffect(() => {
    // PocketBase認証状態の監視
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(pb.authStore.model)
    })

    // リアルタイム通知数の監視
    pb.collection('notifications').subscribe('*', (e) => {
      if (e.action === 'create' && e.record.user === user?.id) {
        setNotifications(prev => prev + 1)
      }
    })

    return () => {
      unsubscribe()
      pb.collection('notifications').unsubscribe()
    }
  }, [user])

  return (
    <div className="flex h-screen flex-col">
      {/* Sticky Top Bar with PocketBase user info */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-xl font-semibold">Feed</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon">
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
                {notifications}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Main Feed */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation with PocketBase integration */}
      <nav className="border-t bg-background">
        <div className="flex items-center justify-around py-2">
          <Button variant="ghost" size="icon" className="h-12 w-12 touch-target">
            <Home className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="h-12 w-12 touch-target">
            <Search className="h-6 w-6" />
          </Button>
          <Button size="icon" className="h-12 w-12 rounded-full touch-target">
            <Plus className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="h-12 w-12 touch-target relative">
            <Bell className="h-6 w-6" />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
                {notifications > 9 ? '9+' : notifications}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-12 w-12 touch-target">
            {user?.avatar ? (
              <img src={pb.files.getUrl(user, user.avatar)} alt="Profile" className="h-6 w-6 rounded-full" />
            ) : (
              <User className="h-6 w-6" />
            )}
          </Button>
        </div>
      </nav>
    </div>
  )
}
```

#### Tailwind CSS 4 設定
```css
/* src/app/globals.css */
@layer base {
  .mobile-nav-item {
    @apply flex h-12 w-12 items-center justify-center rounded-lg transition-colors hover:bg-accent;
  }
  
  .touch-target {
    @apply min-h-[44px] min-w-[44px] p-2;
  }
  
  /* PocketBaseリアルタイム更新アニメーション */
  .realtime-update {
    @apply animate-pulse duration-500;
  }
}
```

---

### 2. Two-Pane (Master-Detail) / Supporting-Pane
**対象画面幅：600-960px（タブレット・折りたたみデバイス）**

#### 構成要素
- **Navigation Rail**：固定アイコン列（3-7項目）
- **メインフィード**：コンテンツ表示領域
- **サブペイン**：スレッド詳細・プロフィール表示

#### 設計根拠
- Android ComposeのSupportingPaneScaffoldが想定する寸法帯
- 画面の横幅を効率的に活用
- タブレット特有の使用パターンに最適化

#### 転換ロジック
- 600px未満：Navigation Rail → Drawer、サブペイン → モーダル画面
- 960px以上：3カラムレイアウトへ移行

#### shadcn/ui実装例
```tsx
// src/shared/ui/two-pane-layout.tsx
import { Button } from "@/shared/ui/button"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Separator } from "@/shared/ui/separator"
import { pb } from "@/shared/lib/pocketbase"
import { Home, Search, Bell, User, MessageSquare, Settings } from "lucide-react"
import { useEffect, useState } from "react"

export function TwoPaneLayout({
  children,
  sidePanel
}: {
  children: React.ReactNode
  sidePanel?: React.ReactNode
}) {
  const [user, setUser] = useState(pb.authStore.model)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    // PocketBase接続状態の監視
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="hidden md:grid md:grid-cols-[80px_1fr] lg:grid-cols-[80px_1fr_320px] h-screen relative">
      {/* オフラインインジケータ */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-white text-center py-1 text-sm z-50">
          オフラインモード
        </div>
      )}
      {/* Navigation Rail */}
      <aside className="border-r bg-muted/50">
        <ScrollArea className="h-full">
          <div className="flex flex-col items-center gap-4 py-4">
            <Button variant="ghost" size="icon" className="h-12 w-12">
              <Home className="h-6 w-6" />
            </Button>
            <Button variant="ghost" size="icon" className="h-12 w-12">
              <Search className="h-6 w-6" />
            </Button>
            <Button variant="ghost" size="icon" className="h-12 w-12">
              <Bell className="h-6 w-6" />
            </Button>
            <Button variant="ghost" size="icon" className="h-12 w-12">
              <MessageSquare className="h-6 w-6" />
            </Button>
            <Separator className="my-4 w-8" />
            <Button variant="ghost" size="icon" className="h-12 w-12">
              <User className="h-6 w-6" />
            </Button>
            <Button variant="ghost" size="icon" className="h-12 w-12">
              <Settings className="h-6 w-6" />
            </Button>
          </div>
        </ScrollArea>
      </aside>

      {/* Main Feed */}
      <main className="overflow-y-auto">
        {children}
      </main>

      {/* Supporting Pane (Desktop only) */}
      {sidePanel && (
        <aside className="hidden lg:block border-l bg-muted/50">
          <ScrollArea className="h-full">
            <div className="p-4">
              {sidePanel}
            </div>
          </ScrollArea>
        </aside>
      )}
    </div>
  )
}
```

#### Tailwind CSS 4 コンテナクエリ活用
```css
@layer components {
  .nav-rail {
    @apply flex flex-col items-center gap-4;
    container-type: inline-size;
  }

  @container (min-width: 120px) {
    .nav-rail {
      @apply gap-6;
    }
  }
}
```

---

### 3. Three-Column (Collapsible Holy-Grail Lite)
**対象画面幅：≥ 960px（デスクトップ）**

#### 構成要素
- **左サイドバー**：メインナビゲーション
- **中央カラム**：メインフィード
- **右サイドバー**：トレンド・広告・推奨コンテンツ

#### 設計根拠
- Twitter(X)、LinkedInなど主要SNSが採用する標準パターン
- 大画面の情報表示能力を最大活用
- 段階的な表示制御でモバイル互換性を保持

#### shadcn/ui実装例
```tsx
// src/shared/ui/three-column-layout.tsx
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Separator } from "@/shared/ui/separator"
import { Badge } from "@/shared/ui/badge"
import { pb } from "@/shared/lib/pocketbase"
import { TrendingUp, Hash, Users, Home, Search, Bell, MessageSquare } from "lucide-react"
import { useEffect, useState } from "react"

export function ThreeColumnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden xl:grid xl:grid-cols-[280px_1fr_320px] h-screen max-w-7xl mx-auto gap-6">
      {/* Left Sidebar */}
      <aside className="border-r">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            <nav className="space-y-2">
              <Button variant="ghost" className="w-full justify-start">
                <Home className="mr-3 h-5 w-5" />
                ホーム
              </Button>
              <Button variant="ghost" className="w-full justify-start">
                <Search className="mr-3 h-5 w-5" />
                検索
              </Button>
              <Button variant="ghost" className="w-full justify-start">
                <Bell className="mr-3 h-5 w-5" />
                通知
              </Button>
              <Button variant="ghost" className="w-full justify-start">
                <MessageSquare className="mr-3 h-5 w-5" />
                メッセージ
              </Button>
            </nav>

            <Separator />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">コミュニティ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" size="sm" className="w-full justify-start h-8">
                  <Users className="mr-2 h-4 w-4" />
                  React開発者
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start h-8">
                  <Hash className="mr-2 h-4 w-4" />
                  デザイン
                </Button>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </aside>

      {/* Main Feed */}
      <main className="overflow-y-auto">
        {children}
      </main>

      {/* Right Sidebar */}
      <aside className="border-l">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  トレンド
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">#ReactJS</p>
                  <p className="text-xs text-muted-foreground">15.2K posts</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">#TailwindCSS</p>
                  <p className="text-xs text-muted-foreground">8.7K posts</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">おすすめユーザー</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div>
                      <p className="text-sm font-medium">@username</p>
                      <p className="text-xs text-muted-foreground">フォロワー 1.2K</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">フォロー</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </aside>
    </div>
  )
}
```

#### Tailwind CSS 4 グリッドシステム
```css
@layer components {
  .desktop-layout {
    @apply hidden xl:grid xl:grid-cols-[280px_1fr_320px] h-screen max-w-7xl mx-auto;
    container-type: inline-size;
  }

  @container (min-width: 1400px) {
    .desktop-layout {
      @apply gap-8;
    }
  }
}
```

---

### 4. Off-Canvas Drawer
**用途：複雑な階層ナビゲーション**

#### 特徴
- ハンバーガーメニューから横スライドイン
- 深い階層構造の情報を効率的に収納
- モバイル限定表示を推奨

#### shadcn/ui実装例
```tsx
// src/shared/ui/off-canvas-drawer.tsx
import { Sheet, SheetContent, SheetTrigger } from "@/shared/ui/sheet"
import { Button } from "@/shared/ui/button"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Separator } from "@/shared/ui/separator"
import { pb } from "@/shared/lib/pocketbase"
import { Menu, Home, Search, Bell, User, Settings, HelpCircle } from "lucide-react"
import { useEffect, useState } from "react"

export function OffCanvasDrawer() {
  const [user, setUser] = useState(pb.authStore.model)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    // PocketBaseユーザー情報の取得
    const fetchProfile = async () => {
      if (user) {
        try {
          const userProfile = await pb.collection('users').getOne(user.id)
          setProfile(userProfile)
        } catch (error) {
          console.error('Profile fetch error:', error)
        }
      }
    }
    
    fetchProfile()
    
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(pb.authStore.model)
    })
    
    return unsubscribe
  }, [user])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="space-y-4">
              {/* Profile Section with PocketBase data */}
              <div className="flex items-center gap-3 pb-4">
                {profile?.avatar ? (
                  <img 
                    src={pb.files.getUrl(profile, profile.avatar)} 
                    alt="Profile" 
                    className="h-12 w-12 rounded-full object-cover" 
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-6 w-6 text-primary-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-semibold">{profile?.name || user?.email || 'ユーザー名'}</p>
                  <p className="text-sm text-muted-foreground">@{profile?.username || user?.username || 'username'}</p>
                </div>
              </div>

              <Separator />

              {/* Main Navigation */}
              <nav className="space-y-1">
                <Button variant="ghost" className="w-full justify-start">
                  <Home className="mr-3 h-5 w-5" />
                  ホーム
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Search className="mr-3 h-5 w-5" />
                  検索
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Bell className="mr-3 h-5 w-5" />
                  通知
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <User className="mr-3 h-5 w-5" />
                  プロフィール
                </Button>
              </nav>

              <Separator />

              {/* Secondary Navigation */}
              <nav className="space-y-1">
                <Button variant="ghost" className="w-full justify-start">
                  <Settings className="mr-3 h-5 w-5" />
                  設定
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <HelpCircle className="mr-3 h-5 w-5" />
                  ヘルプ
                </Button>
              </nav>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
```

#### Responsive制御
```tsx
// レスポンシブ表示制御
export function ResponsiveNavigation() {
  return (
    <>
      {/* Mobile: Drawer */}
      <div className="md:hidden">
        <OffCanvasDrawer />
      </div>

      {/* Desktop: Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
    </>
  )
}
```

---

### 5. Bottom Sheet
**用途：一時的な操作・詳細表示**

#### 適用場面
- 投稿オプション設定
- シェア機能
- 文脈依存の操作メニュー

#### 設計思想
- 行動を途切れさせずに補助情報を提示
- モバイル特化のインタラクション

#### shadcn/ui実装例
```tsx
// src/shared/ui/bottom-sheet.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet"
import { Button } from "@/shared/ui/button"
import { Separator } from "@/shared/ui/separator"
import { pb } from "@/shared/lib/pocketbase"
import { Share, Copy, Download, Flag, Bookmark, MoreVertical } from "lucide-react"
import { useState } from "react"

interface BottomSheetProps {
  trigger: React.ReactNode
  title: string
  children?: React.ReactNode
}

export function BottomSheet({ trigger, title, children }: BottomSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[80vh] rounded-t-xl"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center">{title}</SheetTitle>
        </SheetHeader>

        {children || (
          <div className="space-y-2 pb-4">
            <Button variant="ghost" className="w-full justify-start">
              <Share className="mr-3 h-5 w-5" />
              シェア
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Copy className="mr-3 h-5 w-5" />
              リンクをコピー
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Bookmark className="mr-3 h-5 w-5" />
              保存
            </Button>

            <Separator className="my-2" />

            <Button variant="ghost" className="w-full justify-start">
              <Download className="mr-3 h-5 w-5" />
              ダウンロード
            </Button>
            <Button variant="ghost" className="w-full justify-start text-destructive">
              <Flag className="mr-3 h-5 w-5" />
              報告
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// 使用例
export function PostActions() {
  return (
    <BottomSheet
      trigger={
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      }
      title="投稿オプション"
    />
  )
}
```

---

## ブレークポイント定義

| 画面幅 | Tailwind Class | ナビゲーション | ペイン数 | 代表例 |
|--------|----------------|----------------|----------|---------|
| < 768px | `base` | Bottom Navigation | 1 | Instagram モバイル |
| 768-1280px | `md:` `lg:` | Navigation Rail | 2 | Chromebook版 Twitter |
| ≥ 1280px | `xl:` | 固定サイドバー | 3 | LinkedIn PC版 |

### Tailwind CSS 4 設定
```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
  },
}
```

### CSS変数とレイヤー設定
```css
/* globals.css */
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    /* ... shadcn/ui CSS variables */
  }
}

@layer components {
  .responsive-layout {
    @apply transition-all duration-200 ease-in-out;
  }

  .nav-transition {
    @apply transform transition-transform duration-300 ease-in-out;
  }
}
```

---

## ナビゲーション設計ガイドライン

### 項目数の推奨範囲
- **Bottom Navigation**：3-5項目（Material Design準拠）
- **Navigation Rail**：3-7項目
- **Sidebar**：制限なし（階層化により整理）

### 必須機能の配置
1. **フィード閲覧**：常に最も目立つ位置
2. **投稿機能**：FABまたはヘッダーボタンで常時アクセス可能
3. **プロフィール・設定**：ナビゲーション内で一貫した位置
4. **通知**：ヘッダー領域で視認性を確保

---

## 実装指針

### 1. shadcn/ui コンポーネント活用 (FSD構造対応)
```tsx
// src/shared/ui/responsive-layout.tsx
import {
  Button, Card, Sheet, ScrollArea, Separator, Badge
} from "@/shared/ui"
import { pb } from "@/shared/lib/pocketbase"
import { MobileLayout } from "@/shared/ui/mobile-layout"
import { TwoPaneLayout } from "@/shared/ui/two-pane-layout"
import { ThreeColumnLayout } from "@/shared/ui/three-column-layout"
import { useEffect, useState } from "react"

// レイアウトの基本構成 (PocketBase統合)
export function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(pb.authStore.model)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // PocketBase認証状態の初期化
    setIsLoading(false)
    
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(pb.authStore.model)
    })
    
    return unsubscribe
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <>
      {/* Mobile Layout */}
      <div className="md:hidden">
        <MobileLayout>{children}</MobileLayout>
      </div>

      {/* Tablet Layout */}
      <div className="hidden md:block xl:hidden">
        <TwoPaneLayout>{children}</TwoPaneLayout>
      </div>

      {/* Desktop Layout */}
      <div className="hidden xl:block">
        <ThreeColumnLayout>{children}</ThreeColumnLayout>
      </div>
    </>
  )
}
```

### 2. Tailwind CSS 4 新機能活用
```css
/* コンテナクエリを使用した適応的デザイン */
@layer components {
  .feed-container {
    container-type: inline-size;
  }

  @container (min-width: 600px) {
    .feed-item {
      @apply p-6;
    }
  }

  @container (min-width: 900px) {
    .feed-item {
      @apply grid grid-cols-[1fr_auto] gap-4;
    }
  }
}

/* CSS-in-JS代替としてのTailwind機能 */
@layer utilities {
  .glass-effect {
    @apply bg-background/80 backdrop-blur-sm border border-border/50;
  }

  .nav-focus {
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
  }
}
```

### 3. TypeScript型定義 (PocketBase統合)
```tsx
// src/entities/layout/model/types.ts
export interface LayoutProps {
  children: React.ReactNode
  sidePanel?: React.ReactNode
  className?: string
}

export interface NavigationItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge?: number
  requiresAuth?: boolean
}

// PocketBaseユーザー型
export interface PocketBaseUser {
  id: string
  email: string
  username?: string
  name?: string
  avatar?: string
  created: string
  updated: string
}

export interface ResponsiveLayoutConfig {
  mobile: {
    navigation: NavigationItem[]
    maxItems: number
  }
  tablet: {
    navigation: NavigationItem[]
    showSidePanel: boolean
  }
  desktop: {
    navigation: NavigationItem[]
    showRightSidebar: boolean
  }
}

// PocketBaseリアルタイム更新型
export interface RealtimeEvent<T = any> {
  action: 'create' | 'update' | 'delete'
  record: T
}
```

### 4. パフォーマンス最適化
```tsx
// 遅延ローディングとコード分割
import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const ThreeColumnLayout = lazy(() => import('./three-column-layout'))
const TwoPaneLayout = lazy(() => import('./two-pane-layout'))

export function OptimizedLayout() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <div className="hidden xl:block">
        <ThreeColumnLayout />
      </div>
      <div className="hidden md:block xl:hidden">
        <TwoPaneLayout />
      </div>
      <div className="md:hidden">
        <MobileLayout />
      </div>
    </Suspense>
  )
}
```

---

## アクセシビリティ要件

### shadcn/ui標準準拠
shadcn/uiはRadix UI Primitivesをベースとしており、WAI-ARIA準拠のアクセシビリティが組み込まれています。

```tsx
// 適切なARIA属性の使用例
import { Button } from "@/components/ui/button"
import { NavigationMenu, NavigationMenuItem } from "@/components/ui/navigation-menu"

export function AccessibleNavigation() {
  return (
    <NavigationMenu>
      <NavigationMenuItem>
        <Button
          variant="ghost"
          aria-label="ホームに移動"
          className="nav-focus"
        >
          <Home className="h-5 w-5" />
          <span className="sr-only">ホーム</span>
        </Button>
      </NavigationMenuItem>
    </NavigationMenu>
  )
}
```

### タッチターゲット（Tailwind CSS 4対応）
```css
@layer components {
  .touch-target {
    @apply min-h-[44px] min-w-[44px] p-2;
  }

  .touch-target-large {
    @apply min-h-[48px] min-w-[48px] p-3;
  }

  /* Focus管理 */
  .focus-visible-ring {
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background;
  }
}
```

### キーボードナビゲーション
```tsx
// キーボードショートカット実装
import { useEffect } from 'react'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K で検索
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        // 検索モーダルを開く
      }

      // Escape でモーダル/Drawer を閉じる
      if (event.key === 'Escape') {
        // 開いているモーダルを閉じる
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
```

### Screen Reader対応
```tsx
// Live Region を使用した動的コンテンツ通知
import { useState } from 'react'

export function LiveRegionExample() {
  const [announcement, setAnnouncement] = useState('')

  const handleNewPost = () => {
    setAnnouncement('新しい投稿が追加されました')
    // 3秒後にクリア
    setTimeout(() => setAnnouncement(''), 3000)
  }

  return (
    <>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      {/* その他のコンテンツ */}
    </>
  )
}
```

---

## 統合例とベストプラクティス

### ❗ 重要な開発制約

#### iframe認証システムと変更禁止ファイル

**絶対に変更してはいけないファイル:**

1. **`App.tsx`** - iframe認証システムを管理するメインコンポーネント
2. **`main.tsx`** - アプリケーションのエントリーポイント
3. **`src/shared/lib/pocketbase.ts`** - PocketBase接続設定

**理由:**
- このアプリは親アプリからiframe経由で認証情報を受信する特殊なシステム
- `App.tsx`はこの認証フローを管理しており、変更すると認証が機能しなくなる
- PocketBase設定は特定の構成で最適化されており、変更は非推奨

#### 開発フローの制約

- **禁止コマンド**: `npm run dev` (開発サーバーは無効化済み)
- **推奨コマンド**: `npm run build:watch` (自動再ビルドで開発)
- **ビルド確認**: `npm run build` (ビルドエラーの即座修正が必須)

#### PocketBase統合の必須事項

- **🚨 必須使用**: `src/shared/lib/pocketbase.ts`の`pb`インスタンスのみを使用
- **🚨 直接インポート禁止**: PocketBaseライブラリの直接インポートは厳格禁止
- **🚨 統一インスタンス**: `import { pb } from "@/shared/lib/pocketbase"`でアクセス統一
- **認証自動適用**: 全API呼び出しで認証ヘッダーが自動付与される
- **永続化機能**: LocalStorage + Cookie の二重永続化により認証状態が自動維持される
- **機能活用**: リアルタイム更新、ファイルアップロード、高度なフィルタリングなどを積極活用

### 完全なレスポンシブレイアウト実装 (FSD + PocketBase統合)
```tsx
// src/app/layout.tsx - ❗重要: App.tsxは変更禁止ファイルです
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { pb } from '@/shared/lib/pocketbase'
import { ResponsiveLayout } from '@/shared/ui/responsive-layout'

// ❗ App.tsxは変更禁止 - iframe認証システムを管理
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const [authInitialized, setAuthInitialized] = useState(false)

  useEffect(() => {
    // iframeからの認証情報を受信 (App.tsxで処理済み)
    // ここではPocketBase認証状態の確認のみ実行
    const checkAuth = async () => {
      try {
        if (pb.authStore.isValid) {
          // 認証済みユーザーの情報を検証
          await pb.collection('users').authRefresh()
        }
      } catch (error) {
        console.log('Auth check failed:', error)
      } finally {
        setAuthInitialized(true)
        setMounted(true)
      }
    }

    checkAuth()
  }, [])

  if (!mounted || !authInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className={cn(
      "min-h-screen bg-background font-sans antialiased",
      "responsive-layout"
    )}>
      <ResponsiveLayout>{children}</ResponsiveLayout>
    </div>
  )
}
```

### Context API を使用した状態管理 (FSD + PocketBase統合)
```tsx
// src/app/providers/layout-provider.tsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { pb } from '@/shared/lib/pocketbase'
import type { PocketBaseUser } from '@/entities/layout/model/types'

interface LayoutContextType {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  activeView: 'feed' | 'search' | 'notifications' | 'profile'
  setActiveView: (view: string) => void
  user: PocketBaseUser | null
  isOnline: boolean
  notifications: number
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeView, setActiveView] = useState<'feed' | 'search' | 'notifications' | 'profile'>('feed')
  const [user, setUser] = useState<PocketBaseUser | null>(pb.authStore.model)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [notifications, setNotifications] = useState(0)

  useEffect(() => {
    // PocketBase認証状態の監視
    const unsubscribeAuth = pb.authStore.onChange(() => {
      setUser(pb.authStore.model)
    })

    // オンライン/オフライン状態の監視
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // リアルタイム通知の監視
    if (user) {
      pb.collection('notifications').subscribe('*', (e) => {
        if (e.action === 'create' && e.record.user === user.id) {
          setNotifications(prev => prev + 1)
        }
      })
    }

    return () => {
      unsubscribeAuth()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      pb.collection('notifications').unsubscribe()
    }
  }, [user])

  return (
    <LayoutContext.Provider value={{
      sidebarOpen,
      setSidebarOpen,
      activeView,
      setActiveView,
      user,
      isOnline,
      notifications,
    }}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}
```

### テスト戦略 (FSD + PocketBase対応)
```tsx
// src/shared/ui/__tests__/responsive-layout.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { ResponsiveLayout } from '@/shared/ui/responsive-layout'
import { LayoutProvider } from '@/app/providers/layout-provider'
import { pb } from '@/shared/lib/pocketbase'

// PocketBaseモック
vitest.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    authStore: {
      model: { id: 'test-user', email: 'test@example.com' },
      isValid: true,
      onChange: vitest.fn(() => () => {}),
    },
    collection: vitest.fn(() => ({
      subscribe: vitest.fn(),
      unsubscribe: vitest.fn(),
    })),
  },
}))

// モバイル表示テスト
describe('Responsive Layout with PocketBase', () => {
  const renderWithProvider = (children: React.ReactNode) => {
    return render(
      <LayoutProvider>
        {children}
      </LayoutProvider>
    )
  }

  it('shows bottom navigation on mobile with user auth', async () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

    renderWithProvider(
      <ResponsiveLayout>Test Content</ResponsiveLayout>
    )

    await waitFor(() => {
      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })
  })

  it('handles offline state correctly', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    })

    renderWithProvider(
      <ResponsiveLayout>Test Content</ResponsiveLayout>
    )

    await waitFor(() => {
      expect(screen.getByText('オフラインモード')).toBeInTheDocument()
    })
  })

  it('shows navigation rail on tablet', async () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    })

    renderWithProvider(
      <ResponsiveLayout>Test Content</ResponsiveLayout>
    )

    await waitFor(() => {
      // タブレット用のナビゲーションレールが表示されることを確認
      expect(screen.queryByRole('navigation')).toBeInTheDocument()
    })
  })
})
```

### パフォーマンス最適化設定
```tsx
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeCss: true, // Tailwind CSS 4 最適化
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}

module.exports = nextConfig
```
