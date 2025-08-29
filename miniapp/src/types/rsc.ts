import type { ReactFormState } from 'react-dom/client'

// RSC環境でシリアライズされ、SSR/Client環境でデシリアライズされるペイロードのスキーマ
export type RscPayload = {
  // このデモではルートhtml要素全体をレンダリング/シリアライゼーション/デシリアライゼーションしますが、
  // この仕組みは独自のルート規約に基づいて異なるコンポーネント部分をレンダリング/フェッチするように変更できます
  root: React.ReactNode
  // プログレッシブエンハンスメント以外のケースでのサーバーアクション戻り値
  returnValue?: unknown
  // プログレッシブエンハンスメントケースでのサーバーアクションフォーム状態（useActionStateなど）
  formState?: ReactFormState
}