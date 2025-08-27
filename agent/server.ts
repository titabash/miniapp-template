// agent-api.ts
// Railway フロントエンドコンテナ内で動作する Agent 実行 API サーバー

import { spawn } from 'child_process'

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

async function executeAgentCommand(req: AgentExecuteRequest): Promise<AgentExecuteResult> {
  const startTime = Date.now()
  
  // コマンド構築 - 元のコマンド形式を再現
  const args = [
    'tsx',
    '/app/agent/index.ts',
    req.userPrompt,
    req.aiPrompt,
    req.userId,
    req.miniappId,
  ]

  // オプション引数を追加
  if (req.resume) {
    args.push('--resume')
  }
  if (req.model) {
    args.push('--model', req.model)
  }

  return new Promise((resolve, reject) => {
    console.log(`[Agent] Executing: npx ${args.join(' ')}`)
    
    const childProcess = spawn('npx', args, {
      cwd: '/app/agent',
      env: {
        ...process.env,
        // Agent用環境変数
        NODE_ENV: 'production',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    childProcess.stdout.on('data', (data) => {
      const text = data.toString()
      stdout += text
      // リアルタイムでログ出力
      console.log(`[Agent STDOUT] ${text.trim()}`)
    })

    childProcess.stderr.on('data', (data) => {
      const text = data.toString()
      stderr += text
      console.log(`[Agent STDERR] ${text.trim()}`)
    })

    childProcess.on('close', (exitCode) => {
      const duration = Date.now() - startTime
      console.log(`[Agent] Process finished with exit code ${exitCode} in ${duration}ms`)
      
      // JSON出力をパースしてみる
      let parsedOutput = null
      try {
        // Agent がJSONを出力する場合
        const jsonMatch = stdout.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsedOutput = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        // JSON パースに失敗した場合は無視
      }

      resolve({
        stdout,
        stderr,
        exitCode: exitCode || 0,
        duration,
        parsedOutput,
      })
    })

    childProcess.on('error', (error) => {
      console.error(`[Agent] Process error:`, error)
      reject(error)
    })

    // タイムアウト (5分)
    setTimeout(() => {
      console.warn(`[Agent] Process timeout, killing...`)
      childProcess.kill('SIGKILL')
      reject(new Error('Agent execution timeout (5 minutes)'))
    }, 300000)
  })
}

// Simple HTTP server using Node.js built-in modules
import * as http from 'http'
import * as url from 'url'

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const parsedUrl = url.parse(req.url || '', true)
  const pathname = parsedUrl.pathname

  // Health check
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      agentPath: '/app/agent/index.ts',
      pid: process.pid,
    }))
    return
  }

  // Agent execution endpoint
  if (req.method === 'POST' && pathname === '/execute/agent') {
    try {
      let body = ''
      req.on('data', chunk => {
        body += chunk.toString()
      })

      req.on('end', async () => {
        try {
          const request: AgentExecuteRequest = JSON.parse(body)
          
          // 入力検証
          const required = ['userPrompt', 'aiPrompt', 'userId', 'miniappId']
          const missing = required.filter(field => !request[field as keyof AgentExecuteRequest])
          
          if (missing.length > 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              success: false,
              error: `Missing required parameters: ${missing.join(', ')}`,
            }))
            return
          }

          console.log(`[Agent] Starting execution for user ${request.userId}, miniapp ${request.miniappId}`)
          
          const result = await executeAgentCommand(request)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            success: true,
            result,
            request: {
              userPrompt: request.userPrompt,
              aiPrompt: request.aiPrompt,
              userId: request.userId,
              miniappId: request.miniappId,
              resume: request.resume,
              model: request.model,
            },
            timestamp: new Date().toISOString(),
          }))

        } catch (error) {
          console.error('[Agent] Execution failed:', error)
          
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          }))
        }
      })

    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: false,
        error: 'Invalid request format',
      }))
    }
    return
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    error: 'Not found',
    availableEndpoints: [
      'GET /health',
      'POST /execute/agent',
    ],
  }))
})

const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Agent API] Server running on http://0.0.0.0:${PORT}`)
  console.log(`[Agent API] Available endpoints:`)
  console.log(`[Agent API] - GET  /health`)
  console.log(`[Agent API] - POST /execute/agent`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Agent API] Received SIGTERM, shutting down gracefully')
  server.close(() => {
    console.log('[Agent API] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[Agent API] Received SIGINT, shutting down gracefully')
  server.close(() => {
    console.log('[Agent API] Server closed')
    process.exit(0)
  })
})