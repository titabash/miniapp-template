import {
  renderToReadableStream,
  createTemporaryReferenceSet,
  decodeReply,
  loadServerAction,
  decodeAction,
  decodeFormState,
} from '@vitejs/plugin-rsc/rsc'
import type { ReactFormState } from 'react-dom/client'
import type { RscPayload } from './types/rsc.ts'
import App from './App.tsx'

// プラグインはデフォルトでrscエントリーがリクエストハンドラーのdefault exportを持つことを想定しています。
// ただし、サーバーエントリーの実行方法は、@cloudflare/vite-pluginなどの独自サーバーハンドラーを登録することでカスタマイズできます。
export default async function handler(request: Request): Promise<Response> {
  // サーバー関数リクエストの処理
  const isAction = request.method === 'POST'
  let returnValue: unknown | undefined
  let formState: ReactFormState | undefined
  let temporaryReferences: unknown | undefined
  
  if (isAction) {
    // x-rsc-actionヘッダーは、アクションがReactClient.setServerCallback経由で呼び出された場合に存在します
    const actionId = request.headers.get('x-rsc-action')
    if (actionId) {
      const contentType = request.headers.get('content-type')
      const body = contentType?.startsWith('multipart/form-data')
        ? await request.formData()
        : await request.text()
      temporaryReferences = createTemporaryReferenceSet()
      const args = await decodeReply(body, { temporaryReferences })
      const action = await loadServerAction(actionId)
      returnValue = await action.apply(null, args)
    } else {
      // そうでなければ、サーバー関数は<form action={...}>経由で呼び出されます
      // ハイドレーション前（JavaScriptが無効な場合など）
      // いわゆるプログレッシブエンハンスメント
      const formData = await request.formData()
      const decodedAction = await decodeAction(formData)
      const result = await decodedAction()
      formState = await decodeFormState(result, formData)
    }
  }

  // ReactのVDOMツリーからRSCストリームへのシリアライゼーション
  // サーバー関数リクエストの処理後にRSCストリームをレンダリングして
  // 新しいレンダリングがサーバー関数呼び出しからの更新された状態を反映し、
  // サーバーからのミューテートとフェッチを単一のラウンドトリップで実現する
  const url = new URL(request.url)
  const rscPayload: RscPayload = {
    root: <App url={url.href} />,
    formState,
    returnValue,
  }
  const rscOptions = { temporaryReferences }
  const rscStream = renderToReadableStream<RscPayload>(rscPayload, rscOptions)

  // フレームワークの規約に基づいてHTMLレンダリングなしでRSCストリームを応答
  // ここではリクエストヘッダーのcontent-typeを使用
  // さらに、ペイロードを直接簡単に表示するため?__rscと?__htmlを許可
  const isRscRequest =
    (!request.headers.get('accept')?.includes('text/html') &&
      !url.searchParams.has('__html')) ||
    url.searchParams.has('__rsc')

  if (isRscRequest) {
    return new Response(rscStream, {
      headers: {
        'content-type': 'text/x-component;charset=utf-8',
        vary: 'accept',
      },
    })
  }

  // HTMLレンダリングのためにSSR環境に委譲
  // プラグインはRSC環境でSSR環境エントリーモジュールをロードするための
  // loadSsrModuleヘルパーを提供しますが、これは@cloudflare/vite-pluginの
  // サービスバインディングなどの独自ランタイム通信を実装することでカスタマイズできます
  const ssrEntryModule = await (import.meta as any).viteRsc.loadModule(
    'ssr', 'index'
  ) as typeof import('./entry.ssr.tsx')
  const htmlStream = await ssrEntryModule.renderHTML(rscStream, {
    formState,
    // JavaScriptが無効なブラウザーの簡単なシミュレーションを許可
    debugNojs: url.searchParams.has('__nojs'),
  })

  // HTMLを応答
  return new Response(htmlStream, {
    headers: {
      'Content-type': 'text/html',
      vary: 'accept',
    },
  })
}

if (import.meta.hot) {
  import.meta.hot.accept()
}
