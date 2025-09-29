# 認証・認可システム仕様書

## 🚨 重要事項（変更厳禁）

**この認証システムは絶対に変更してはいけません。**

- `App.tsx` - メイン認証制御コンポーネント（**変更厳禁**）
- `src/features/auth/model/useAuth.ts` - 認証ロジック（**変更厳禁**）
- `main.tsx` - エントリーポイント（**変更厳禁**）
- `src/features/auth/api/actions.ts` - Server Functions 認証API（**変更厳禁**）

**これらのファイルを変更するとアプリケーション全体が機能しなくなります。**

## システム概要

このミニアプリは **iframe内で動作する特殊な認証機構** を持っています。親アプリから認証情報を受け取り、Server Functions 経由でPocketBaseに認証を行う仕組みです。

### アーキテクチャ図

```
親アプリ (Weavo)
    ↓ postMessage (認証情報)
iframe (ミニアプリ)
    ↓ useMiniAppAuth フック
Server Functions API (/actions エンドポイント)
    ↓ PocketBase認証
ミニアプリ全体への認証状態共有
```

## 認証フロー詳細

### 1. 初期化フロー (`main.tsx`)

```typescript
// Server Functions 用のグローバル関数を定義
declare global {
  interface Window {
    callServerFunction: <T = any>(functionName: string, ...args: any[]) => Promise<T>
  }
}

// Server Functions 呼び出し用のヘルパー関数
window.callServerFunction = async <T = any>(functionName: string, ...args: any[]): Promise<T> => {
  const response = await fetch('/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ functionName, args })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Server function call failed')
  }

  return data.result
}

// グローバルエラーハンドリングを設定
window.addEventListener('error', (event) => {
  // 親アプリにエラーを通知
  window.parent.postMessage({
    type: 'iframe_error',
    error: errorMessage,
    details: { ... }
  }, '*');
});

// Promise rejection エラーも処理
window.addEventListener('unhandledrejection', (event) => {
  // 親アプリにエラーを通知
});

// Reactアプリを起動
<StrictMode>
  <App />
</StrictMode>
```

**重要な処理:**

- Server Functions 呼び出し用のグローバル関数定義
- `/actions` エンドポイントへのHTTPリクエスト
- グローバルエラーハンドリング設定
- 全てのエラーを親アプリに通知
- React Strict Modeでアプリを起動

### 2. メイン認証制御 (`App.tsx`)

```typescript
function App() {
  const { authStatus, authMessage, refreshAuth } = useMiniAppAuth();

  // 認証エラー時
  if (authStatus === "error") {
    return <認証エラー画面 />; // リトライ・リロード機能付きのshadcn/ui Card
  }

  // 認証処理中
  if (authStatus === "checking" || authStatus === "authenticating") {
    return <ローディング画面 />; // スピナー付きローディング
  }

  // 認証待機中
  if (authStatus === "idle") {
    return <認証待機画面 />; // shadcn/ui Card + プロセスバー
  }

  // 認証成功 → メインアプリを表示
  return <AppRouter />;
}
```

**認証ステータス:**

- `checking`: 初期認証状態検証中
- `idle`: 認証情報待機中
- `authenticating`: 認証処理実行中
- `success`: 認証成功（メインアプリ表示）
- `error`: 認証エラー

### 3. 認証ロジック (`src/features/auth/model/useAuth.ts`)

#### 3-1. 初期化と状態管理

```typescript
export function useMiniAppAuth(): UseAuthReturn {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [authMessage, setAuthMessage] = useState<string>('初期化中...')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // 認証処理用のAbortControllerを管理
  const authControllerRef = useRef<AbortController | null>(null)

  // 同期実行中フラグ（useRef で即座に確認可能）
  const isAuthenticatingRef = useRef<boolean>(false)

  // デバウンス用タイマー管理
  const debounceTimerRef = useRef<number | null>(null)
}
```

#### 3-2. Server Functions 認証処理（核心機能）

```typescript
const handleAuthentication = useCallback(
  async (email: string, password: string) => {
    // 多重実行防止チェック
    if (isAuthenticatingRef.current) {
      return
    }

    // AbortController で前回の処理をキャンセル
    if (authControllerRef.current) {
      authControllerRef.current.abort()
    }

    const authController = new AbortController()
    authControllerRef.current = authController
    isAuthenticatingRef.current = true

    setAuthStatus('authenticating')
    setAuthMessage('認証中...')

    try {
      // Server Functions で認証実行
      const authResult = await window.callServerFunction<AuthResult>(
        'authenticateUser',
        email,
        password
      )

      if (authResult.success && authResult.user && authResult.record) {
        setUser(authResult.record)
        setIsAuthenticated(true)
        setAuthStatus('success')
        setAuthMessage('認証済み')
        notifyAuthSuccess(authResult.user)
      } else {
        throw new Error(authResult.error || '認証に失敗しました')
      }
    } catch (error) {
      // 認証失敗時に自動ユーザー作成を試行
      setAuthMessage('新しいユーザーを作成中...')

      const createResult = await window.callServerFunction<AuthResult>(
        'createUser',
        email,
        password
      )

      if (createResult.success && createResult.user && createResult.record) {
        setUser(createResult.record)
        setIsAuthenticated(true)
        setAuthStatus('success')
        notifyAuthSuccess(createResult.user)
      } else {
        setAuthStatus('error')
        setAuthMessage(`認証失敗: ${createResult.error}`)
        notifyAuthFailure(createResult.error)
      }
    } finally {
      isAuthenticatingRef.current = false
      if (authControllerRef.current === authController) {
        authControllerRef.current = null
      }
    }
  },
  [notifyAuthSuccess, notifyAuthFailure]
)
```

**重要ポイント:**

- **Server Functions ベース認証**: `/actions` エンドポイント経由でPocketBaseに認証
- **自動ユーザー作成**: 認証失敗時に自動的に新規ユーザー作成を試行
- **多重実行防止**: AbortController + useRef による確実な重複処理防止
- **デバウンス処理**: 50msの短時間デバウンスで連続呼び出しを防止

#### 3-3. 親アプリとの通信

```typescript
// postMessage監視（デバウンス処理付き）
useEffect(() => {
  const controller = new AbortController()

  const handleMessage = async (event: Event) => {
    if (controller.signal.aborted) return

    const messageEvent = event as MessageEvent<PostMessageData>
    const data = messageEvent.data

    if (data && data.type === 'auth') {
      // 既に認証済み or 認証処理中の場合はスキップ
      if (isAuthenticated || isAuthenticatingRef.current) {
        return
      }

      const { email, password } = data.data
      // デバウンス処理で認証実行
      debouncedHandleAuthentication(email, password)
    }
  }

  window.addEventListener('message', handleMessage)
  return () => {
    controller.abort()
    window.removeEventListener('message', handleMessage)
  }
}, [debouncedHandleAuthentication, isAuthenticated])

// 親アプリへの通知関数
const notifyParentReady = () => {
  window.parent.postMessage(
    {
      type: 'miniapp_ready',
      data: { timestamp: new Date().toISOString() },
    },
    '*'
  )
}

const notifyAuthSuccess = (userData: { id: string; email: string }) => {
  window.parent.postMessage(
    {
      type: 'auth_result',
      data: { success: true, user: userData },
    },
    '*'
  )
}

const notifyAuthFailure = (error: string) => {
  window.parent.postMessage(
    {
      type: 'auth_result',
      data: { success: false, error },
    },
    '*'
  )
}
```

**通信プロトコル:**

- **受信**: `{ type: "auth", data: { email, password } }`
- **送信**: `{ type: "miniapp_ready", data: { timestamp } }`
- **送信**: `{ type: "auth_result", data: { success: user/error } }`

## Server Functions 認証API (`src/features/auth/api/actions.ts`)

### 4-1. 認証関数 (`authenticateUser`)

```typescript
export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthResult & { token?: string; record?: User }> {
  'use server'

  try {
    // ユーザー認証用のPocketBaseインスタンス（API Rules適用）
    const pb = new PocketBase(
      process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
    )

    // 通常のユーザー認証を実行
    const authData = await pb
      .collection('users')
      .authWithPassword(email, password)

    const user: User = {
      id: authData.record.id as string,
      email: authData.record.email as string,
      emailVisibility: (authData.record.emailVisibility as boolean) ?? false,
      verified: (authData.record.verified as boolean) ?? false,
      created: authData.record.created as string,
      updated: authData.record.updated as string,
      name: (authData.record.name as string) ?? '',
      avatar: (authData.record.avatar as string) ?? '',
    }

    return {
      success: true,
      user: { id: authData.record.id, email: authData.record.email },
      token: authData.token,
      record: user,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.message || 'サーバー認証エラーが発生しました',
    }
  }
}
```

### 4-2. ユーザー作成関数 (`createUser`)

```typescript
export async function createUser(
  email: string,
  password: string
): Promise<AuthResult & { token?: string; record?: User }> {
  'use server'

  try {
    // ユーザー作成用のPocketBaseインスタンス（API Rules適用）
    const pb = new PocketBase(
      process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
    )

    // 通常のユーザー作成（API Rulesが適用される）
    const userData = await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      emailVisibility: true,
    })

    // 作成後に認証を実行
    return await authenticateUser(email, password)
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.message || 'サーバーユーザー作成エラーが発生しました',
    }
  }
}
```

### 4-3. リフレッシュ機能

```typescript
export async function refreshAuth(
  token: string
): Promise<{ success: boolean; error?: string }> {
  'use server'

  try {
    const pb = new PocketBase(
      process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
    )
    pb.authStore.save(token, null)

    if (!pb.authStore.isValid) {
      return { success: false, error: '認証されていません' }
    }

    await pb.collection('users').authRefresh()
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error:
        error.response?.message ||
        'サーバー認証リフレッシュエラーが発生しました',
    }
  }
}
```

## Server Functions 統合による認証システム

### 認証状態の管理方式

このアーキテクチャでは、**PocketBaseの永続化機能を使用せず**、Server Functions ベースでの認証を行います。

```typescript
// ❌ 以前のPocketBaseクライアント直接利用（削除済み）
// import { pb } from "@/shared/lib/pocketbase";
// const authData = await pb.collection("users").authWithPassword(email, password);

// ✅ 新しいServer Functions ベース認証
const authResult = await window.callServerFunction<AuthResult>(
  'authenticateUser',
  email,
  password
)
```

### 認証状態の特徴

**Server Functions ベースの利点:**

- **ステートレス認証**: フロントエンド側でトークンを永続化せず、セキュリティを向上
- **サーバーサイド処理**: PocketBase処理をサーバーサイドで実行し、クライアント負荷を軽減
- **エラーハンドリング**: サーバーサイドでエラー処理を統一
- **API制限回避**: PocketBaseの直接アクセス制限を Server Functions で回避

## エラーハンドリング

### Server Functions エラーの適切な処理

```typescript
// Server Functions 内でのPocketBaseエラー処理
try {
  const authData = await pb
    .collection('users')
    .authWithPassword(email, password)
  return { success: true, user: authData.record, token: authData.token }
} catch (error: any) {
  console.error('Server認証失敗:', error)
  return {
    success: false,
    error: error.response?.message || 'サーバー認証エラーが発生しました',
  }
}

// フロントエンド側でのServer Functions エラー処理
try {
  const authResult = await window.callServerFunction<AuthResult>(
    'authenticateUser',
    email,
    password
  )

  if (!authResult.success) {
    throw new Error(authResult.error || '認証に失敗しました')
  }

  // 認証成功処理
} catch (error) {
  const errorMessage =
    error instanceof Error ? error.message : '認証エラーが発生しました'
  setAuthStatus('error')
  setAuthMessage(`認証失敗: ${errorMessage}`)
  notifyAuthFailure(errorMessage)
}
```

**エラーハンドリングの特徴:**

- **サーバーサイドエラー処理**: PocketBaseエラーをServer Functions内で適切にキャッチ
- **クライアントサイド統一処理**: Server Functions のレスポンス形式を統一してエラー処理
- **ユーザーフレンドリーメッセージ**: 技術的エラーをユーザー向けメッセージに変換

### グローバルエラーハンドリング

`main.tsx`でキャッチした全てのエラーは親アプリに通知されます:

```typescript
window.parent.postMessage({
  type: 'iframe_error',
  error: errorMessage,
  details: { ... }
}, '*');
```

## セキュリティ仕様

### 認証フロー制限

- **自動ユーザー作成機能が実装済み**: 認証失敗時に自動的に新規ユーザー作成を試行
- 新規ユーザーは email/password の組み合わせで自動作成される
- PocketBase の API Rules に従い、適切な権限でユーザー作成/認証が実行される
- Server Functions 経由での認証により、クライアント側でのPocketBase直接アクセスを制限

### 通信セキュリティ

- 親アプリとの通信は`postMessage`API使用
- Origin検証は実装されていない（iframe内での動作前提）
- **認証情報の管理**: Server Functions ベースによりクライアント側でトークンを永続化しない
- **サーバーサイド処理**: 認証処理はServer Functions で実行され、セキュリティが向上

## 開発時の重要な注意点

### ✅ 正しい使用方法

```typescript
// 認証状態の確認
import { useMiniAppAuth } from "@/features/auth";

function MyComponent() {
  const { isAuthenticated, user, authStatus } = useMiniAppAuth();

  if (!isAuthenticated) {
    return <div>認証が必要です</div>;
  }

  return <div>こんにちは、{user?.email}さん</div>;
}

// Server Functions を使った認証関連API呼び出し
const authenticateUser = async (email: string, password: string) => {
  try {
    const result = await window.callServerFunction<AuthResult>(
      'authenticateUser', email, password
    );

    if (result.success) {
      console.log('認証成功:', result.user);
    } else {
      console.error('認証失敗:', result.error);
    }
  } catch (error) {
    console.error('Server Function エラー:', error);
  }
};

// ミニアプリ内でPocketBaseが必要な場合は、新しいServer Functionsを作成
const fetchMiniAppData = async () => {
  try {
    const result = await window.callServerFunction('getMiniAppData');
    return result;
  } catch (error) {
    console.error('データ取得エラー:', error);
  }
};
```

### ❌ 禁止事項

```typescript
// ❌ PocketBaseの直接インポートと使用
import PocketBase from 'pocketbase'
const pb = new PocketBase('...')

// ❌ 認証フローのファイル変更
// App.tsx, src/features/auth/model/useAuth.ts, main.tsx, src/features/auth/api/actions.ts の変更

// ❌ クライアント側でのPocketBase直接操作
const pb = new PocketBase('...')
await pb.collection('users').authWithPassword(email, password) // 危険

// ❌ 認証状態の手動操作
setIsAuthenticated(true) // useMiniAppAuth内部でのみ許可
```

## デバッグとログ

### 認証フローのログ出力

開発者ツールのConsoleで以下のログを確認可能:

```
[useMiniAppAuth] 初期化完了
[useMiniAppAuth] 親アプリにminiapp_ready通知を送信
[useMiniAppAuth] postMessageリスナーを登録
[useMiniAppAuth] postMessage受信: { origin, type, hasData, isCurrentlyAuthenticating, timestamp }
[useMiniAppAuth] 認証メッセージを受信 - デバウンス認証処理を開始
[useMiniAppAuth] 認証処理開始: { email }
Server認証失敗: [PocketBase Error Details]
[useMiniAppAuth] 認証失敗 - 自動ユーザー作成を試行
[useMiniAppAuth] ユーザー作成開始: { email }
Server ユーザー作成成功: user@example.com
[useMiniAppAuth] ユーザー作成成功: user@example.com
[useMiniAppAuth] 親アプリに認証成功を通知
```

**ログの特徴:**

- **多重実行防止**: 実行中フラグの状態をログで確認可能
- **デバウンス処理**: 連続呼び出し防止の動作を確認可能
- **自動ユーザー作成**: 認証失敗時の自動フォールバック処理
- **Server Functions**: サーバーサイド処理の詳細ログ

### トラブルシューティング

**認証が進まない場合:**

1. 親アプリからの`postMessage`が送信されているか確認
2. Server Functions エンドポイント (`/actions`) の動作状況確認
3. PocketBaseサーバーの接続状況確認（Server Functions 経由）
4. コンソールログで多重実行防止やデバウンス処理の動作確認

**認証エラーが発生する場合:**

1. エラーメッセージの詳細を確認（Server Functions のレスポンスを確認）
2. 認証情報（email/password）の妥当性確認
3. PocketBaseサーバーのログ確認（Server Functions 内部処理）
4. 自動ユーザー作成処理の動作確認

**Server Functions 関連のトラブル:**

1. `/actions` エンドポイントの応答確認
2. `window.callServerFunction` の動作確認
3. Server Functions 内でのPocketBase接続エラー確認

## まとめ

この認証システムは**iframe環境での特殊な認証要件**に対応したServer Functions ベース設計です:

1. **親アプリからの認証情報受信** (postMessage API)
2. **Server Functions 経由でのPocketBase認証実行** (/actions エンドポイント)
3. **React状態管理による認証状態管理** (useMiniAppAuth フック)
4. **自動ユーザー作成とフォールバック処理** (認証失敗時の自動対応)
5. **多重実行防止とデバウンス処理** (AbortController + useRef)
6. **セキュアなサーバーサイド認証** (クライアント側トークン非永続化)

**絶対に変更してはいけません。この仕組みに依存してアプリケーション全体が構築されています。**

### 🚨 変更厳禁ファイル

- `App.tsx` - メイン認証制御コンポーネント
- `main.tsx` - Server Functions 初期化とグローバルエラーハンドリング
- `src/features/auth/model/useAuth.ts` - 認証ロジックとpostMessage処理
- `src/features/auth/api/actions.ts` - Server Functions 認証API
