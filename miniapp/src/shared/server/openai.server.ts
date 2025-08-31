import OpenAI from 'openai'

// Server Functions 用のOpenAIクライアントインスタンス作成
export async function createOpenAIInstance(): Promise<OpenAI> {
  "use server"
  
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error(
      'OpenAI API key が設定されていません。環境変数 OPENAI_API_KEY を設定してください。'
    )
  }
  
  const openai = new OpenAI({
    apiKey: apiKey,
    // タイムアウト設定（30秒）
    timeout: 30000,
  })
  
  // 開発環境でのログ出力
  if (process.env.NODE_ENV === 'development') {
    console.log('[OpenAI] サーバーインスタンス初期化完了')
  }
  
  return openai
}

// OpenAI API呼び出し用の共通エラーハンドリング
export function handleOpenAIError(error: unknown): string {
  "use server"
  
  if (error instanceof Error) {
    // OpenAI APIエラーの場合
    if ('status' in error && 'message' in error) {
      const apiError = error as {
        status?: number;
        message: string;
      }
      
      switch (apiError.status) {
        case 400:
          return 'リクエストが無効です。パラメータを確認してください。'
        case 401:
          return 'OpenAI API キーが無効です。'
        case 403:
          return 'OpenAI API へのアクセスが拒否されました。'
        case 429:
          return 'OpenAI API の使用制限に達しました。しばらく待ってから再試行してください。'
        case 500:
          return 'OpenAI API サーバーエラーが発生しました。'
        case 503:
          return 'OpenAI API が一時的に利用できません。'
        default:
          return `OpenAI API エラー: ${apiError.message}`
      }
    }
    
    return error.message
  }
  
  return 'OpenAI API で予期しないエラーが発生しました。'
}

// よく使用されるモデル定数
export const OPENAI_MODELS = {
  // GPT-5 シリーズ（最新）
  GPT_5: 'gpt-5',
  GPT_5_MINI: 'gpt-5-mini',
  GPT_5_NANO: 'gpt-5-nano',
  GPT_5_CHAT_LATEST: 'gpt-5-chat-latest',
  
  // o-シリーズ（推論特化）
  O3_MINI: 'o3-mini',
} as const

// 共通のOpenAI設定
export const OPENAI_CONFIG = {
  // チャット完了のデフォルト設定
  CHAT_DEFAULTS: {
    model: OPENAI_MODELS.GPT_5_MINI, // GPT-5-miniをデフォルトに設定
    temperature: 0.7,
    max_tokens: 1000,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  },
  
  // 高性能な推論タスク用設定
  REASONING_DEFAULTS: {
    model: OPENAI_MODELS.GPT_5, // フル機能のGPT-5
    temperature: 0.3, // より一貫性のある推論のため低めに設定
    max_tokens: 2000,
    reasoning_effort: 'medium', // GPT-5の推論レベル
  },
  
  // 高速・軽量タスク用設定
  LIGHTWEIGHT_DEFAULTS: {
    model: OPENAI_MODELS.GPT_5_NANO, // 最も軽量なGPT-5
    temperature: 0.7,
    max_tokens: 500,
  },
} as const