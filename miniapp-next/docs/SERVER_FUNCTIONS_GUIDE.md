# Server Functions 利用ガイド

## 概要

このプロジェクトでは、Server Functions を通じてサーバーサイド処理を安全かつ効率的に実行できます。フロントエンドから `window.callServerFunction()` を使用して、バックエンド機能にアクセスできます。

## 利用可能な機能

### ✅ **対応済み機能**

現在、以下の機能が `src/shared/server/` に実装済みで利用可能です：

#### 1. **OpenAI API統合** (`openai.server.ts`)
- GPT-5シリーズモデルによるテキスト生成
- 推論特化モデル（o3-mini）
- エラーハンドリング機能
- 設定プリセット（チャット、推論、軽量タスク用）

**利用可能なモデル:**
- `gpt-5`: 最高性能フル機能版
- `gpt-5-mini`: バランス型（デフォルト）
- `gpt-5-nano`: 超高速・軽量版
- `gpt-5-chat-latest`: チャット最適化版
- `o3-mini`: 推論特化モデル

#### 2. **fal.ai API統合** (`fal.server.ts`)
- 画像生成（Flux Dev/Pro/Schnell）
- 動画生成（MiniMax Video）
- 音声認識（Whisper）
- ファイルアップロード機能
- リアルタイム接続（WebSocket）
- エラーハンドリング機能

**利用可能なモデル:**
- **画像生成**: `flux/dev`, `flux/pro`, `flux/schnell`, `stable-diffusion-xl`
- **動画生成**: `minimax-video/text-to-video`, `minimax-video/image-to-video`
- **音声**: `whisper`

#### 3. **PocketBase統合** (`pocketbase.server.ts`)
- PocketBaseインスタンス作成
- リクエスト毎に独立したデータベース接続

### ❌ **未対応機能**

以下の機能は現在 `src/shared/server/` に実装されておらず、利用できません：

- **メール送信機能**
- **PDF生成・処理**
- **暗号化・復号化**
- **Webhook処理**
- **スケジューリング・バッチ処理**
- **Embedding・ベクトル検索**
- **その他の外部API統合**

## 基本的な使用方法

### 🚨 **重要な設定手順**

**1. Server Functions の登録**

Server Functions を作成後、`src/entry.rsc.tsx` の `serverFunctions` オブジェクトに登録する必要があります：

```typescript
// src/entry.rsc.tsx
import { exampleFunction } from './features/example/api/actions'

// Server Functions のマップ
const serverFunctions = {
  exampleFunction,  // ← 作成したServer Functionを追加
};
```

**この登録を忘れると、フロントエンドからの呼び出しが失敗します。**

### Server Function の作成

```typescript
// src/features/example/api/actions.ts
import { createOpenAIInstance, OPENAI_CONFIG } from '@/shared/server/openai.server'

export interface ExampleResult {
  success: boolean
  data?: string
  error?: string
}

export async function exampleFunction(input: string): Promise<ExampleResult> {
  "use server"

  try {
    const openai = await createOpenAIInstance()

    const completion = await openai.chat.completions.create({
      ...OPENAI_CONFIG.CHAT_DEFAULTS,
      messages: [
        { role: "user", content: input }
      ]
    })

    return {
      success: true,
      data: completion.choices[0]?.message?.content || ''
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '処理中にエラーが発生しました'
    }
  }
}
```

### フロントエンドからの呼び出し

```typescript
// コンポーネント内での使用例
import { useState } from 'react'
import type { ExampleResult } from '@/features/example/api/actions'

function ExampleComponent() {
  const [result, setResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (input: string) => {
    setIsLoading(true)

    try {
      const response = await window.callServerFunction<ExampleResult>(
        'exampleFunction',
        input
      )

      if (response.success && response.data) {
        setResult(response.data)
      } else {
        console.error('エラー:', response.error)
      }
    } catch (error) {
      console.error('Server Function呼び出しエラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => handleSubmit('テスト入力')}
        disabled={isLoading}
      >
        {isLoading ? '処理中...' : 'Server Function実行'}
      </button>
      <div>{result}</div>
    </div>
  )
}
```

## 詳細利用例

### fal.ai機能の利用例

#### 1. **画像生成**

```typescript
// Server Function
import { generateImage, FAL_CONFIG } from '@/shared/server/fal.server'

export async function createImage(prompt: string): Promise<ExampleResult> {
  "use server"

  try {
    const result = await generateImage(prompt, {
      ...FAL_CONFIG.IMAGE_DEFAULTS,
      num_images: 1
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error
      }
    }

    return {
      success: true,
      data: JSON.stringify(result.data)
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '画像生成に失敗しました'
    }
  }
}

// フロントエンド
const result = await window.callServerFunction<ExampleResult>(
  'createImage',
  '美しい夕日の風景'
)
```

#### 2. **動画生成**

```typescript
// Server Function
import { generateVideo, FAL_CONFIG } from '@/shared/server/fal.server'

export async function createVideo(prompt: string): Promise<ExampleResult> {
  "use server"

  const result = await generateVideo(prompt, {
    ...FAL_CONFIG.VIDEO_DEFAULTS,
    duration: "10s"
  })

  return {
    success: result.success,
    data: result.success ? JSON.stringify(result.data) : undefined,
    error: result.error
  }
}
```

#### 3. **音声認識**

```typescript
// Server Function
import { transcribeAudio } from '@/shared/server/fal.server'

export async function transcribeAudioFile(audioUrl: string): Promise<ExampleResult> {
  "use server"

  const result = await transcribeAudio(audioUrl, {
    language: 'ja',
    task: 'transcribe'
  })

  return {
    success: result.success,
    data: result.success ? JSON.stringify(result.data) : undefined,
    error: result.error
  }
}
```

## OpenAI機能の詳細利用例

### 1. **基本的なテキスト生成**

```typescript
// Server Function
export async function generateText(prompt: string): Promise<ExampleResult> {
  "use server"

  const openai = await createOpenAIInstance()

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODELS.GPT_5_MINI,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1000
  })

  return {
    success: true,
    data: completion.choices[0]?.message?.content || ''
  }
}

// フロントエンド
const result = await window.callServerFunction<ExampleResult>(
  'generateText',
  'TypeScriptについて説明してください'
)
```

### 2. **推論特化処理**

```typescript
// Server Function
export async function complexReasoning(problem: string): Promise<ExampleResult> {
  "use server"

  const openai = await createOpenAIInstance()

  const completion = await openai.chat.completions.create({
    ...OPENAI_CONFIG.REASONING_DEFAULTS, // GPT-5 + 推論設定
    messages: [
      {
        role: "system",
        content: "あなたは論理的思考が得意な専門家です。段階的に問題を解決してください。"
      },
      { role: "user", content: problem }
    ]
  })

  return {
    success: true,
    data: completion.choices[0]?.message?.content || ''
  }
}

// フロントエンド
const result = await window.callServerFunction<ExampleResult>(
  'complexReasoning',
  '複雑な数学問題: 2x + 3y = 12, x - y = 2 を解いてください'
)
```

### 3. **高速処理（軽量版）**

```typescript
// Server Function
export async function quickResponse(query: string): Promise<ExampleResult> {
  "use server"

  const openai = await createOpenAIInstance()

  const completion = await openai.chat.completions.create({
    ...OPENAI_CONFIG.LIGHTWEIGHT_DEFAULTS, // GPT-5-nano使用
    messages: [{ role: "user", content: query }]
  })

  return {
    success: true,
    data: completion.choices[0]?.message?.content || ''
  }
}

// フロントエンド
const result = await window.callServerFunction<ExampleResult>(
  'quickResponse',
  '簡潔に答えて: 今日の天気は？'
)
```

## PocketBase統合の利用例

```typescript
// Server Function
import { createPocketBaseInstance } from '@/shared/server/pocketbase.server'

export async function getUserData(userId: string): Promise<ExampleResult> {
  "use server"

  try {
    const pb = await createPocketBaseInstance()

    // 認証処理（必要に応じて）
    // await pb.collection('users').authWithPassword(email, password)

    const user = await pb.collection('users').getOne(userId)

    return {
      success: true,
      data: JSON.stringify(user)
    }
  } catch (error) {
    return {
      success: false,
      error: 'ユーザーデータの取得に失敗しました'
    }
  }
}
```

## 環境変数

Server Functions で使用する以下の環境変数は既に設定済みです：

- `OPENAI_API_KEY`: OpenAI API アクセス用
- `FAL_KEY`: fal.ai API アクセス用
- `POCKETBASE_URL`: PocketBase接続用

**注意**: 環境変数は既に設定済みのため、新たに `.env` ファイルなどを作成する必要はありません。

## エラーハンドリングのベストプラクティス

```typescript
export async function robustServerFunction(input: string): Promise<ExampleResult> {
  "use server"

  try {
    // 入力検証
    if (!input || input.trim().length === 0) {
      return {
        success: false,
        error: '入力が空です'
      }
    }

    const openai = await createOpenAIInstance()

    const completion = await openai.chat.completions.create({
      ...OPENAI_CONFIG.CHAT_DEFAULTS,
      messages: [{ role: "user", content: input }]
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      return {
        success: false,
        error: 'OpenAIからレスポンスが取得できませんでした'
      }
    }

    return {
      success: true,
      data: content
    }
  } catch (error) {
    console.error('Server Function エラー:', error)

    // OpenAI APIエラーの詳細処理
    if (error instanceof Error && 'status' in error) {
      const apiError = error as any

      switch (apiError.status) {
        case 401:
          return { success: false, error: 'OpenAI API キーが無効です' }
        case 429:
          return { success: false, error: 'API使用制限に達しました。しばらく待ってから再試行してください' }
        case 500:
          return { success: false, error: 'OpenAI APIサーバーエラーが発生しました' }
        default:
          return { success: false, error: `API エラー: ${apiError.message}` }
      }
    }

    return {
      success: false,
      error: '予期しないエラーが発生しました'
    }
  }
}
```

## 注意事項

### ✅ **推奨事項**
- Server Functions は必ず `"use server"` ディレクティブを付ける
- エラーハンドリングを必ず実装する
- レスポンス型を明確に定義する
- 入力データの検証を行う

### ⚠️ **制限事項**
- `src/shared/server/` に実装されていない機能は使用不可
- 新しい外部サービスの統合には追加実装が必要
- ファイルアップロードなどの機能は別途実装が必要

### 🔒 **セキュリティ**
- API キーなどの機密情報は環境変数で管理
- Server Functions 内でのみ機密情報にアクセス
- フロントエンドに機密データを送信しない

## FSD準拠のアーキテクチャ

このプロジェクトではFeature Sliced Design（FSD）に基づいて、Server Actionsを適切な層に配置します。

### 📁 正しい配置パターン

#### 1. **機能別（Features層）**
特定のビジネス機能に関連するServer Actions：

```
src/features/
├── image-generation/       # 画像生成機能
│   ├── api/
│   │   ├── generateImage.ts    # 画像生成Server Action
│   │   └── uploadImage.ts      # 画像アップロードServer Action
│   ├── model/
│   └── ui/
├── chat/                   # チャット機能
│   ├── api/
│   │   ├── sendMessage.ts      # メッセージ送信Server Action
│   │   └── getChatHistory.ts   # 履歴取得Server Action
│   ├── model/
│   └── ui/
```

#### 2. **エンティティ別（Entities層）**
特定のドメインモデルに関連するServer Actions：

```
src/entities/
├── user/                   # ユーザーエンティティ
│   ├── api/
│   │   ├── getUser.ts          # ユーザー取得Server Action
│   │   ├── updateProfile.ts    # プロフィール更新Server Action
│   │   └── deleteUser.ts       # ユーザー削除Server Action
│   ├── model/
│   └── lib/
├── post/                   # 投稿エンティティ
│   ├── api/
│   │   ├── createPost.ts       # 投稿作成Server Action
│   │   └── getPosts.ts         # 投稿一覧取得Server Action
│   ├── model/
│   └── lib/
```

#### 3. **共通ライブラリ（Shared層）**
どの機能からも利用可能な純粋なAPIクライアント：

```
src/shared/
├── server/                 # Server統合クライアント
│   ├── fal.server.ts          # fal.ai APIクライアント
│   ├── openai.server.ts       # OpenAI APIクライアント
│   └── pocketbase.server.ts   # PocketBase APIクライアント
├── lib/
│   └── utils.ts               # 汎用ユーティリティ
└── ui/                     # 共通UIコンポーネント
```

### ✅ 正しい実装例

#### **Features層での実装**
```typescript
// src/features/image-generation/api/generateImage.ts
"use server";
import { generateImage } from "@/shared/server/fal.server";

export async function generateImageAction(prompt: string, options?: ImageOptions) {
  return await generateImage(prompt, options);
}
```

#### **Entities層での実装**
```typescript
// src/entities/user/api/updateProfile.ts  
"use server";
import { createPocketBaseInstance } from "@/shared/server/pocketbase.server";

export async function updateUserProfileAction(userId: string, data: UserData) {
  const pb = await createPocketBaseInstance();
  return await pb.collection('users').update(userId, data);
}
```

### 📐 層の責務分離

| 層 | 責務 | 実装内容 |
|---|---|---|
| **shared/server/** | 純粋なAPIクライアント | 外部サービスとの低レベル通信 |
| **entities/*/api/** | ドメインモデル操作 | 特定エンティティのCRUD操作 |
| **features/*/api/** | ビジネス機能実装 | 複数エンティティを横断する機能 |

### ❌ 避けるべきパターン

```typescript
// ❌ shared に機能固有のServer Actionを置かない
// src/shared/server/actions/imageGeneration.ts  // これは間違い

// ✅ features に機能固有のServer Actionを配置
// src/features/image-generation/api/generateImage.ts  // これが正しい
```

## 拡張方法

### **新機能追加の手順**

#### **Step 1: 共通ライブラリ作成（必要に応じて）**
```typescript
// src/shared/server/newservice.server.ts
export async function createNewServiceClient() {
  "use server";
  // 新しい外部サービスのクライアント実装
}
```

#### **Step 2: 機能別Server Action作成**
```typescript
// src/features/new-feature/api/newAction.ts
"use server";
import { createNewServiceClient } from "@/shared/server/newservice.server";

export async function newFeatureAction(input: string): Promise<ExampleResult> {
  const client = await createNewServiceClient();
  // ビジネスロジック実装
}
```

#### **Step 3: entry.rsc.tsxに登録**
```typescript
// src/entry.rsc.tsx
import { newFeatureAction } from './features/new-feature/api/newAction';

const serverFunctions = {
  newFeatureAction,  // ← 追加
};
```

#### **Step 4: フロントエンドから呼び出し**
```typescript
const result = await window.callServerFunction<ExampleResult>(
  'newFeatureAction',
  'パラメータ'
);
```

### **完全な実装例**

```typescript
// 1. 共通ライブラリ（必要に応じて）
// src/shared/server/translation.server.ts
export async function createTranslationClient() {
  "use server";
  // 翻訳APIクライアント
}

// 2. 機能固有のServer Action
// src/features/translation/api/translateText.ts
"use server";
import { createTranslationClient } from "@/shared/server/translation.server";

export async function translateTextAction(text: string, targetLang: string): Promise<ExampleResult> {
  const client = await createTranslationClient();
  // 翻訳ロジック実装
}

// 3. entry.rsc.tsxに登録
// src/entry.rsc.tsx
import { translateTextAction } from './features/translation/api/translateText';

const serverFunctions = {
  translateTextAction,
};

// 4. フロントエンドから呼び出し
const result = await window.callServerFunction<ExampleResult>(
  'translateTextAction',
  'Hello World'
);
```

このFSD準拠のアーキテクチャにより、**スケーラブルで保守性の高い**Server Actions基盤を実現できます。
