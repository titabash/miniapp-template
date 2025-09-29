// agent-api.ts
// Railway フロントエンドコンテナ内で動作する Agent 実行 API サーバー
// Honoフレームワークを使用した非同期実行管理システム

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { streamSSE } from 'hono/streaming'
import { v4 as uuidv4 } from 'uuid'
import { ChildProcess, spawn } from 'child_process'
import {
  createDevelopmentRecord,
  updateDevelopmentStatusToError,
} from './src/core/database'

// ============================================================================
// Types and Interfaces
// ============================================================================

interface AgentExecuteRequest {
  userPrompt: string
  aiPrompt: string
  userId: string
  miniappId: string
  resume?: boolean
  model?: string
}

interface AgentExecuteResult {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
  parsedOutput?: any
}

interface AgentSession {
  sessionId: string
  childProcess: ChildProcess
  startTime: number
  status: 'running' | 'completed' | 'stopped' | 'error'
  stdout: string
  stderr: string
  exitCode: number | null
  request: AgentExecuteRequest
  timeoutHandle?: NodeJS.Timeout
  developmentRecordId?: string
}

// ============================================================================
// Global State
// ============================================================================

const sessions = new Map<string, AgentSession>()
const app = new Hono()

// ============================================================================
// Middleware
// ============================================================================

app.use('*', cors())
app.use('*', logger())

// ============================================================================
// Helper Functions
// ============================================================================

// プロセスハンドラー設定
function setupProcessHandlers(session: AgentSession) {
  const { childProcess } = session

  childProcess.stdout?.on('data', (data) => {
    session.stdout += data.toString()
    console.log(
      `[Session ${session.sessionId}] STDOUT:`,
      data.toString().trim()
    )
  })

  childProcess.stderr?.on('data', (data) => {
    session.stderr += data.toString()
    console.log(
      `[Session ${session.sessionId}] STDERR:`,
      data.toString().trim()
    )
  })

  childProcess.on('close', async (exitCode) => {
    session.exitCode = exitCode || 0

    // 終了コードが0以外の場合はエラーとして扱う（停止された場合を除く）
    if (exitCode !== 0 && session.status !== 'stopped') {
      session.status = 'error'
      console.error(
        `[Session ${session.sessionId}] Process exited with error code ${exitCode}`
      )

      // developmentステータスをERRORに更新
      if (session.developmentRecordId) {
        console.log(
          `[Session ${session.sessionId}] Updating development status to ERROR (exit code: ${exitCode})`
        )
        try {
          await updateDevelopmentStatusToError(
            { id: session.developmentRecordId },
            `Process exited with error code ${exitCode}`,
            session.sessionId
          )
        } catch (dbError) {
          console.error(
            `[Session ${session.sessionId}] Failed to update development status:`,
            dbError
          )
        }
      }
    } else {
      session.status = session.status === 'stopped' ? 'stopped' : 'completed'
      console.log(
        `[Session ${session.sessionId}] Process exited with code ${exitCode}`
      )
    }

    // タイムアウトハンドルをクリア
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle)
    }
  })

  childProcess.on('error', async (error) => {
    session.status = 'error'
    session.stderr += `Process error: ${error.message}\n`
    console.error(`[Session ${session.sessionId}] Process error:`, error)

    // developmentステータスをERRORに更新
    if (session.developmentRecordId) {
      console.log(
        `[Session ${session.sessionId}] Updating development status to ERROR`
      )
      try {
        await updateDevelopmentStatusToError(
          { id: session.developmentRecordId },
          `Process error: ${error.message}`,
          session.sessionId
        )
      } catch (dbError) {
        console.error(
          `[Session ${session.sessionId}] Failed to update development status:`,
          dbError
        )
      }
    }
  })

  // タイムアウト設定（5分）
  session.timeoutHandle = setTimeout(async () => {
    if (session.status === 'running') {
      console.warn(`[Session ${session.sessionId}] Timeout, killing process`)
      childProcess.kill('SIGKILL')
      session.status = 'error'
      session.stderr += 'Process timeout (5 minutes)\n'

      // developmentステータスをERRORに更新
      if (session.developmentRecordId) {
        console.log(
          `[Session ${session.sessionId}] Updating development status to ERROR (timeout)`
        )
        try {
          await updateDevelopmentStatusToError(
            { id: session.developmentRecordId },
            'Process timeout (5 minutes)',
            session.sessionId
          )
        } catch (dbError) {
          console.error(
            `[Session ${session.sessionId}] Failed to update development status:`,
            dbError
          )
        }
      }
    }
  }, 300000) // 5分 = 300000ms
}

// ============================================================================
// API Endpoints
// ============================================================================

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sessions: sessions.size,
    agentPath: '/app/agent/src/index.ts',
    pid: process.pid,
    framework: 'Hono v4.9.6',
    packageManager: 'pnpm',
  })
})

// Agent実行エンドポイント（非同期実行のみ）
app.post('/execute/agent', async (c) => {
  try {
    const request = await c.req.json<AgentExecuteRequest>()

    // 入力検証
    const required = ['userPrompt', 'aiPrompt', 'userId', 'miniappId']
    const missing = required.filter(
      (field) => !request[field as keyof AgentExecuteRequest]
    )

    if (missing.length > 0) {
      return c.json(
        {
          success: false,
          error: `Missing required parameters: ${missing.join(', ')}`,
        },
        400
      )
    }

    console.log(
      `[Agent] Starting execution for user ${request.userId}, miniapp ${request.miniappId}`
    )

    // localhost:4000 のヘルスチェック
    console.log('[Agent] Checking frontend server health at localhost:4000...')
    try {
      const healthResponse = await fetch('http://localhost:4000', {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5秒タイムアウト
      })

      if (healthResponse.status !== 200) {
        console.error(
          `[Agent] Frontend server returned status ${healthResponse.status}`
        )
        return c.json(
          {
            success: false,
            error: `Frontend server at localhost:4000 is not healthy (status: ${healthResponse.status}). Please ensure the frontend server is running.`,
          },
          503
        )
      }

      console.log('[Agent] Frontend server is healthy (status: 200)')
    } catch (healthError) {
      console.error('[Agent] Frontend server health check failed:', healthError)
      return c.json(
        {
          success: false,
          error:
            'Frontend server at localhost:4000 is not accessible. Please ensure the frontend server is running.',
        },
        503
      )
    }

    // 非同期実行
    const sessionId = uuidv4()

    // developmentRecordを事前に作成
    let developmentRecord: any
    try {
      console.log('[Agent] Creating development record...')
      developmentRecord = await createDevelopmentRecord(
        request.miniappId,
        request.userId,
        request.userPrompt
      )
      console.log(`[Agent] Development record created: ${developmentRecord.id}`)
    } catch (dbError) {
      console.error('[Agent] Failed to create development record:', dbError)
      return c.json(
        {
          success: false,
          error: 'Failed to create development record in database',
        },
        500
      )
    }

    // コマンド構築 - pnpm execを使用
    const args = [
      'exec',
      'tsx',
      'src/index.ts',
      request.userPrompt,
      request.aiPrompt,
      request.userId,
      request.miniappId,
    ]

    // オプション引数を追加
    args.push('--development-id', developmentRecord.id)
    if (request.resume) {
      args.push('--resume')
    }
    if (request.model) {
      args.push('--model', request.model)
    }

    console.log(`[Agent] Starting async execution: pnpm ${args.join(' ')}`)

    const childProcess = spawn('pnpm', args, {
      cwd: process.cwd(), // 現在のディレクトリを使用
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const session: AgentSession = {
      sessionId,
      childProcess,
      startTime: Date.now(),
      status: 'running',
      stdout: '',
      stderr: '',
      exitCode: null,
      request,
      developmentRecordId: developmentRecord.id,
    }

    // バックグラウンドで出力収集
    setupProcessHandlers(session)
    sessions.set(sessionId, session)

    return c.json({
      success: true,
      sessionId,
      status: 'running',
      message: 'Agent execution started',
    })
  } catch (error) {
    console.error('[Agent] Execution failed:', error)

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      500
    )
  }
})

// プロセス停止
app.post('/stop/agent/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  const session = sessions.get(sessionId)

  if (!session) {
    return c.json(
      {
        success: false,
        error: 'Session not found',
      },
      404
    )
  }

  if (session.status !== 'running') {
    return c.json(
      {
        success: false,
        error: `Session is not running (status: ${session.status})`,
      },
      400
    )
  }

  // グレースフルシャットダウン
  session.childProcess.kill('SIGTERM')
  session.status = 'stopped'

  // 5秒後に強制終了
  setTimeout(() => {
    if (session.childProcess.exitCode === null) {
      session.childProcess.kill('SIGKILL')
    }
  }, 5000)

  return c.json({
    success: true,
    sessionId,
    message: 'Stop signal sent to agent',
  })
})

// セッション状態確認
app.get('/status/agent/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  const session = sessions.get(sessionId)

  if (!session) {
    return c.json(
      {
        success: false,
        error: 'Session not found',
      },
      404
    )
  }

  return c.json({
    success: true,
    sessionId,
    status: session.status,
    duration: Date.now() - session.startTime,
    exitCode: session.exitCode,
    stdoutSize: session.stdout.length,
    stderrSize: session.stderr.length,
    request: {
      userId: session.request.userId,
      miniappId: session.request.miniappId,
    },
  })
})

// ログ取得（通常/SSEストリーミング対応）
app.get('/logs/agent/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const session = sessions.get(sessionId)
  const stream = c.req.query('stream') === 'true'

  if (!session) {
    return c.json(
      {
        success: false,
        error: 'Session not found',
      },
      404
    )
  }

  if (stream) {
    // Server-Sent Events でストリーミング
    return streamSSE(c, async (stream) => {
      let lastPosition = 0

      const interval = setInterval(async () => {
        const newLogs = session.stdout.substring(lastPosition)
        if (newLogs) {
          await stream.writeSSE({
            data: JSON.stringify({ logs: newLogs }),
            event: 'log',
          })
          lastPosition = session.stdout.length
        }

        if (session.status !== 'running') {
          await stream.writeSSE({
            data: JSON.stringify({
              status: session.status,
              exitCode: session.exitCode,
            }),
            event: 'complete',
          })
          clearInterval(interval)
          await stream.close()
        }
      }, 100)

      // クライアント切断時のクリーンアップ
      stream.onAbort(() => {
        clearInterval(interval)
      })
    })
  } else {
    // 通常のログ取得
    return c.json({
      success: true,
      sessionId,
      stdout: session.stdout,
      stderr: session.stderr,
      status: session.status,
      exitCode: session.exitCode,
    })
  }
})

// セッション一覧
app.get('/sessions/agent', (c) => {
  const sessionList = Array.from(sessions.values()).map((s) => ({
    sessionId: s.sessionId,
    status: s.status,
    startTime: s.startTime,
    duration: Date.now() - s.startTime,
    userId: s.request.userId,
    miniappId: s.request.miniappId,
    exitCode: s.exitCode,
  }))

  return c.json({
    success: true,
    sessions: sessionList,
    total: sessions.size,
  })
})

// セッション削除
app.delete('/sessions/agent/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  const session = sessions.get(sessionId)

  if (!session) {
    return c.json(
      {
        success: false,
        error: 'Session not found',
      },
      404
    )
  }

  // 実行中の場合は停止
  if (session.status === 'running') {
    session.childProcess.kill('SIGKILL')
  }

  // タイムアウトハンドルをクリア
  if (session.timeoutHandle) {
    clearTimeout(session.timeoutHandle)
  }

  sessions.delete(sessionId)

  return c.json({
    success: true,
    message: `Session ${sessionId} deleted`,
  })
})

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not found',
      availableEndpoints: [
        'GET /health',
        'POST /execute/agent',
        'POST /stop/agent/:sessionId',
        'GET /status/agent/:sessionId',
        'GET /logs/agent/:sessionId',
        'GET /sessions/agent',
        'DELETE /sessions/agent/:sessionId',
      ],
    },
    404
  )
})

// ============================================================================
// Memory Management
// ============================================================================

// 30分経過したセッションを削除
setInterval(() => {
  const now = Date.now()
  let cleanedCount = 0

  for (const [id, session] of sessions) {
    if (
      session.status !== 'running' &&
      now - session.startTime > 30 * 60 * 1000
    ) {
      // タイムアウトハンドルをクリア
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle)
      }
      sessions.delete(id)
      cleanedCount++
      console.log(`[Cleanup] Removed old session ${id}`)
    }
  }

  if (cleanedCount > 0) {
    console.log(`[Cleanup] Removed ${cleanedCount} old sessions`)
  }
}, 60000) // 1分ごと

// ============================================================================
// Server Setup
// ============================================================================

const PORT = 3030
const server = serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '0.0.0.0',
})

console.log(`[Agent API] Server running on http://0.0.0.0:${PORT}`)
console.log(`[Agent API] Using Hono v4.9.6 with @hono/node-server v1.19.1`)
console.log(`[Agent API] Package manager: pnpm`)
console.log(`[Agent API] Available endpoints:`)
console.log(`[Agent API] - GET  /health`)
console.log(`[Agent API] - POST /execute/agent`)
console.log(`[Agent API] - POST /stop/agent/:sessionId`)
console.log(`[Agent API] - GET  /status/agent/:sessionId`)
console.log(`[Agent API] - GET  /logs/agent/:sessionId`)
console.log(`[Agent API] - GET  /sessions/agent`)
console.log(`[Agent API] - DELETE /sessions/agent/:sessionId`)

// ============================================================================
// Graceful Shutdown
// ============================================================================

const gracefulShutdown = () => {
  console.log('[Agent API] Shutting down gracefully')

  // 全実行中セッションを停止
  for (const session of sessions.values()) {
    if (session.status === 'running') {
      console.log(`[Agent API] Stopping session ${session.sessionId}`)
      session.childProcess.kill('SIGTERM')
    }
    // タイムアウトハンドルをクリア
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle)
    }
  }

  // サーバーを閉じる
  server.close(() => {
    console.log('[Agent API] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)
