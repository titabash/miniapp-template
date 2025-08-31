import { createFromReadableStream } from '@vitejs/plugin-rsc/ssr'
import React from 'react'
import type { ReactFormState } from 'react-dom/client'
import { renderToReadableStream } from 'react-dom/server.edge'
import { injectRSCPayload } from 'rsc-html-stream/server'
import type { RscPayload } from './types/rsc.ts'

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options: {
    formState?: ReactFormState
    nonce?: string
    debugNojs?: boolean
  },
) {
  // 1つのRSCストリームを2つに複製
  // - SSRのため（下記のReactClient.createFromReadableStream）
  // - ブラウザーハイドレーションペイロードのため <script>...FLIGHT_DATA...</script> を注入
  const [rscStream1, rscStream2] = rscStream.tee()

  // RSCストリームをReactのVDOMにデシリアライズ
  let payload: Promise<RscPayload> | undefined
  function SsrRoot() {
    // ReactDomServerのプリイニット/プリロードが動作するために
    // ReactDOMServerコンテキスト内でデシリアライゼーションを開始する必要があります
    payload ??= createFromReadableStream<RscPayload>(rscStream1)
    return <FixSsrThenable>{React.use(payload).root}</FixSsrThenable>
  }

  // React SSRのバグを回避するため、SsrRootとユーザーのrootの間に空のコンポーネントを追加
  //   SsrRoot (use)
  //     => FixSsrThenable
  //       => root (lazyやuseを潜在的に持つ)
  // https://github.com/facebook/react/issues/33937#issuecomment-3091349011
  function FixSsrThenable(props: React.PropsWithChildren) {
    return props.children
  }

  // HTML生成（従来のSSR）
  const bootstrapScriptContent =
    await (import.meta as any).viteRsc.loadBootstrapScriptContent('index')
  const htmlStream = await renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent: options?.debugNojs
      ? undefined
      : bootstrapScriptContent,
    nonce: options?.nonce,
    ...(options?.formState && { formState: options.formState }),
  } as any)

  let responseStream: ReadableStream<Uint8Array> = htmlStream
  if (!options?.debugNojs) {
    // 初期RSCストリームは <script>...FLIGHT_DATA...</script> としてHTMLストリームに注入
    // devongovettによるユーティリティを使用 https://github.com/devongovett/rsc-html-stream
    responseStream = responseStream.pipeThrough(
      injectRSCPayload(rscStream2, {
        nonce: options?.nonce,
      }),
    )
  }

  return responseStream
}