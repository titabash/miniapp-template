import PocketBase from 'pocketbase'

// クライアントサイド用 PocketBase インスタンス
export const pb = new PocketBase(
  import.meta.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090"
)

// 自動永続化機能を有効化（LocalStorage + Cookie による二重永続化）
pb.autoCancellation(false)

// 開発環境でのログ出力
if (import.meta.env.DEV) {
  console.log('[PocketBase] クライアントインスタンス初期化:', {
    url: import.meta.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090",
    isValid: pb.authStore.isValid,
    model: pb.authStore.model
  })
}