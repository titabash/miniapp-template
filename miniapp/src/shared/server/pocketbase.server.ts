import PocketBase from 'pocketbase'

/**
 * Server Functions用のPocketBaseインスタンス作成
 *
 * 使用例:
 * - 管理者権限が必要な操作
 * - 機密情報を扱う処理
 * - バッチ処理・データ集計
 * - MastraのAIエージェントからのデータベースアクセス
 * - サーバーサイドでのバリデーションが必要な処理
 *
 * 注意: 基本的にはクライアントサイド（@/shared/lib/pocketbase）を使用し、
 * 必要な場合のみServer Functionsでこの関数を使用してください。
 */
export async function createPocketBaseInstance(): Promise<PocketBase> {
  'use server'

  const pb = new PocketBase(
    process.env.POCKETBASE_URL || 'http://127.0.0.1:8090'
  )

  // 認証情報の自動リフレッシュを無効化（サーバー用途）
  pb.autoCancellation(false)

  // 管理者認証が必要な場合
  if (
    process.env.POCKETBASE_ADMIN_EMAIL &&
    process.env.POCKETBASE_ADMIN_PASSWORD
  ) {
    try {
      await pb.admins.authWithPassword(
        process.env.POCKETBASE_ADMIN_EMAIL,
        process.env.POCKETBASE_ADMIN_PASSWORD
      )

      if (process.env.NODE_ENV === 'development') {
        console.log('[PocketBase Server] 管理者として認証成功')
      }
    } catch (error) {
      console.error('[PocketBase Server] 管理者認証に失敗:', error)
      // 認証失敗してもインスタンスは返す（一般的な操作は可能）
    }
  }

  return pb
}

/**
 * PocketBase APIエラーハンドリング
 */
export function handlePocketBaseError(error: unknown): string {
  if (error instanceof Error) {
    // PocketBase APIエラーの場合
    if ('status' in error && 'message' in error) {
      const apiError = error as {
        status?: number
        message: string
      }

      switch (apiError.status) {
        case 400:
          return 'リクエストが無効です。入力データを確認してください。'
        case 401:
          return '認証が必要です。'
        case 403:
          return 'アクセスが拒否されました。権限を確認してください。'
        case 404:
          return 'リソースが見つかりません。'
        case 429:
          return 'リクエストが多すぎます。しばらく待ってから再試行してください。'
        case 500:
          return 'サーバーエラーが発生しました。'
        default:
          return apiError.message || 'PocketBase APIエラーが発生しました。'
      }
    }

    return error.message
  }

  return '予期しないエラーが発生しました。'
}
