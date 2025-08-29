import {
  createFromReadableStream,
  createFromFetch,
  setServerCallback,
  createTemporaryReferenceSet,
  encodeReply,
} from '@vitejs/plugin-rsc/browser'
import React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { rscStream } from 'rsc-html-stream/client'
import type { RscPayload } from './types/rsc.ts'
import "./index.css";

async function main() {
  // `BrowserRoot`コンポーネントの外部から再レンダリングをトリガーするため
  // `setPayload`関数を保存（サーバー関数呼び出し、ナビゲーション、HMRなど）
  let setPayload: (v: RscPayload) => void

  // CSR用にRSCストリームをReactのVDOMにデシリアライズ
  const initialPayload = await createFromReadableStream<RscPayload>(
    // 初期RSCストリームは <script>...FLIGHT_DATA...</script> としてSSRストリームに注入
    rscStream,
  )

  // RSCペイロードを状態として（再）レンダリングするブラウザールートコンポーネント
  function BrowserRoot() {
    const [payload, setPayload_] = React.useState(initialPayload)

    React.useEffect(() => {
      setPayload = (v) => React.startTransition(() => setPayload_(v))
    }, [setPayload_])

    // クライアントサイドナビゲーションでの再フェッチ/レンダリング
    React.useEffect(() => {
      return listenNavigation(() => fetchRscPayload())
    }, [])

    return payload.root
  }

  // RSCの再フェッチと再レンダリングのトリガー
  async function fetchRscPayload() {
    const payload = await createFromFetch<RscPayload>(
      fetch(window.location.href),
    )
    setPayload(payload)
  }

  // ハイドレーション後のサーバー関数リクエストで
  // Reactによって内部的に呼び出されるハンドラーを登録
  setServerCallback(async (id, args) => {
    const url = new URL(window.location.href)
    const temporaryReferences = createTemporaryReferenceSet()
    const payload = await createFromFetch<RscPayload>(
      fetch(url, {
        method: 'POST',
        body: await encodeReply(args, { temporaryReferences }),
        headers: {
          'x-rsc-action': id,
        },
      }),
      { temporaryReferences },
    )
    setPayload(payload)
    return payload.returnValue
  })

  // ハイドレーション
  const browserRoot = (
    <React.StrictMode>
      <BrowserRoot />
    </React.StrictMode>
  )
  hydrateRoot(document, browserRoot, {
    formState: initialPayload.formState,
  })

  // サーバーコードの変更時にRSCの再フェッチ/レンダリングをトリガーして、サーバーHMRを実装
  if (import.meta.hot) {
    import.meta.hot.on('rsc:update', () => {
      fetchRscPayload()
    })
  }
}

// クライアントサイドナビゲーションのためのイベントインターセプションをセットアップする小さなヘルパー
function listenNavigation(onNavigation: () => void) {
  window.addEventListener('popstate', onNavigation)

  const oldPushState = window.history.pushState
  window.history.pushState = function (...args) {
    const res = oldPushState.apply(this, args)
    onNavigation()
    return res
  }

  const oldReplaceState = window.history.replaceState
  window.history.replaceState = function (...args) {
    const res = oldReplaceState.apply(this, args)
    onNavigation()
    return res
  }

  function onClick(e: MouseEvent) {
    let link = (e.target as Element).closest('a')
    if (
      link &&
      link instanceof HTMLAnchorElement &&
      link.href &&
      (!link.target || link.target === '_self') &&
      link.origin === location.origin &&
      !link.hasAttribute('download') &&
      e.button === 0 && // 左クリックのみ
      !e.metaKey && // 新しいタブで開く（Mac）
      !e.ctrlKey && // 新しいタブで開く（Windows）
      !e.altKey && // ダウンロード
      !e.shiftKey &&
      !e.defaultPrevented
    ) {
      e.preventDefault()
      history.pushState(null, '', link.href)
    }
  }
  document.addEventListener('click', onClick)

  return () => {
    document.removeEventListener('click', onClick)
    window.removeEventListener('popstate', onNavigation)
    window.history.pushState = oldPushState
    window.history.replaceState = oldReplaceState
  }
}

main()
