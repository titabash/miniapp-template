import { spawn } from 'child_process'
import { existsSync } from 'fs'
import type { Options, Query, SDKUserMessage } from './types.js'
import { GeminiQuery } from './query.js'
import { AbortError } from './types.js'

type Props = {
  prompt: string | AsyncIterable<SDKUserMessage>
  options?: Options
}

function createAbortController(): AbortController {
  return new AbortController()
}

export function query({
  prompt,
  options: {
    // Claude Code SDK互換オプション
    abortController = createAbortController(),
    allowedTools = [],
    appendSystemPrompt,
    customSystemPrompt,
    disallowedTools = [],
    maxTurns,
    mcpServers,
    permissionMode = 'default',
    model = 'gemini-2.5-pro',
    fallbackModel,
    canUseTool,
    continue: continueConversation,
    resume,

    // Gemini CLI固有オプション
    sandbox = false,
    debug = false,
    yolo = false,
    allFiles = false,
    showMemoryUsage = false,
    checkpointing = false,
    cwd,
    pathToGeminiExecutable = 'gemini',
    stderr,
    env,
  } = {},
}: Props): Query {
  // 環境変数の設定
  if (!env) {
    env = { ...process.env } as Record<string, string>
  }

  // Gemini CLIの引数を構築
  const args: string[] = []

  // モデル設定
  if (model && model !== 'gemini-2.5-pro') {
    args.push('--model', model)
  }

  // システムプロンプト設定
  if (customSystemPrompt) {
    // Gemini CLIではシステムプロンプトを設定ファイルで処理
    // または環境変数で設定する必要がある場合があります
    console.warn('customSystemPrompt is not directly supported by Gemini CLI')
  }

  if (appendSystemPrompt) {
    console.warn('appendSystemPrompt is not directly supported by Gemini CLI')
  }

  // ターン制限
  if (maxTurns) {
    console.warn('maxTurns is not directly supported by Gemini CLI')
  }

  // ツール設定
  if (allowedTools.length > 0) {
    console.warn('allowedTools is not directly supported by Gemini CLI')
  }

  if (disallowedTools.length > 0) {
    console.warn('disallowedTools is not directly supported by Gemini CLI')
  }

  // MCP サーバー設定
  if (mcpServers && Object.keys(mcpServers).length > 0) {
    console.warn(
      'mcpServers configuration is not directly supported by Gemini CLI command line'
    )
    // Gemini CLIのMCP設定は設定ファイルで行う必要があります
  }

  // 権限モード（Gemini CLIのYOLOモードで近似）
  if (permissionMode === 'bypassPermissions' || yolo) {
    args.push('--yolo')
  }

  // Gemini CLI固有オプション
  if (sandbox) {
    args.push('--sandbox')
  }

  if (debug) {
    args.push('--debug')
  }

  if (allFiles) {
    args.push('--all_files')
  }

  if (showMemoryUsage) {
    args.push('--show_memory_usage')
  }

  if (checkpointing) {
    args.push('--checkpointing')
  }

  // 継続・再開オプション
  if (continueConversation) {
    console.warn('continue option is not directly supported by Gemini CLI')
  }

  if (resume) {
    console.warn('resume option is not directly supported by Gemini CLI')
  }

  // フォールバックモデル
  if (fallbackModel) {
    console.warn('fallbackModel is not supported by Gemini CLI')
  }

  // ツール使用許可コールback
  if (canUseTool) {
    console.warn('canUseTool callback is not supported in Gemini CLI wrapper')
  }

  // プロンプトの処理
  if (typeof prompt === 'string') {
    args.push('--prompt', prompt)
  } else {
    throw new Error(
      'AsyncIterable prompts are not supported yet. Please use string prompts.'
    )
  }

  // Gemini CLIの実行可能ファイルの確認
  if (
    !existsSync(pathToGeminiExecutable) &&
    pathToGeminiExecutable === 'gemini'
  ) {
    // グローバルコマンドとして実行を試行
  }

  console.debug(
    `Spawning Gemini CLI process: ${pathToGeminiExecutable} ${args.join(' ')}`
  )

  // 非TTY環境を強制するため、stdinにダミーデータを送信
  const stderrMode = debug || stderr ? 'pipe' : 'ignore'
  const child = spawn(pathToGeminiExecutable, args, {
    cwd,
    stdio: ['pipe', 'pipe', stderrMode],
    signal: abortController.signal,
    env: {
      ...env,
      // 非TTY環境を強制
      TERM: undefined,
    },
  })

  // 標準入力を即座に閉じる（文字列プロンプトの場合）
  if (typeof prompt === 'string') {
    child.stdin?.write(prompt)
    child.stdin?.end()
  }

  // 標準エラー出力の処理
  if (debug || stderr) {
    child.stderr?.on('data', (data: Buffer) => {
      if (debug) {
        console.error('Gemini CLI stderr:', data.toString())
      }
      if (stderr) {
        stderr(data.toString())
      }
    })
  }

  // クリーンアップ処理
  const cleanup = () => {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }

  abortController.signal.addEventListener('abort', cleanup)
  process.on('exit', cleanup)

  // プロセス終了Promise
  const processExitPromise = new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      cleanup()
      abortController.signal.removeEventListener('abort', cleanup)

      if (abortController.signal.aborted) {
        reject(new AbortError('Gemini CLI process aborted by user'))
        return
      }

      if (code !== 0) {
        reject(new Error(`Gemini CLI process exited with code ${code}`))
        return
      }

      resolve()
    })

    child.on('error', (error) => {
      cleanup()
      abortController.signal.removeEventListener('abort', cleanup)

      if (abortController.signal.aborted) {
        reject(new AbortError('Gemini CLI process aborted by user'))
      } else {
        reject(
          new Error(`Failed to spawn Gemini CLI process: ${error.message}`)
        )
      }
    })
  })

  // GeminiQueryインスタンスを作成して返す
  const geminiQuery = new GeminiQuery(child, processExitPromise)

  // エラーハンドリング
  child.on('error', (error) => {
    if (abortController.signal.aborted) {
      geminiQuery.setError(new AbortError('Gemini CLI process aborted by user'))
    } else {
      geminiQuery.setError(
        new Error(`Failed to spawn Gemini CLI process: ${error.message}`)
      )
    }
  })

  return geminiQuery
}

// 型とエラークラスをエクスポート
export { AbortError } from './types.js'
export type * from './types.js'
