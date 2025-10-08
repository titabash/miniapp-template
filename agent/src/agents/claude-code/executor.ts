import { query } from '@anthropic-ai/claude-agent-sdk'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import type { DevelopmentRecord } from '../../core/types'
import { BuildError } from '../../core/types'
import {
  saveMessageToDatabase,
  saveErrorToAIProcessing,
  updateDevelopmentStatusToCompleted,
  updateDevelopmentStatusToError,
} from '../../core/database'
import { formatMessage } from '../../core/formatter'
import { createPostToolUseHook, createSessionEndHook } from './hooks'

const execAsync = promisify(exec)

// Function to create Claude Code query options
export function createQueryOptions(
  sessionId?: string,
  model?: string
): Options {
  // デバッグ: モデル指定の確認
  console.log(`🔍 createQueryOptions - Received model: "${model}"`)

  // ANTHROPIC_BASE_URLに基づくモデル選択
  let effectiveModel: string
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL

  // if (anthropicBaseUrl === "http://127.0.0.1:4000") {
  //   // LiteLLMプロキシ使用時は渡されたmodelを優先、なければデフォルト
  //   effectiveModel = model || "claude-sonnet-4";
  //   console.log(`🔍 createQueryOptions - Using LiteLLM proxy mode`);
  // } else {
  //   // 通常のAnthropic API使用時は常にsonnet
  //   effectiveModel = "sonnet";
  //   if (model && model !== "sonnet") {
  //     console.log(`⚠️ createQueryOptions - Model "${model}" was requested but overridden to sonnet (Direct API mode)`);
  //   }
  // }

  effectiveModel = model || 'claude-sonnet-4'

  console.log(
    `🔍 createQueryOptions - Using effective model: "${effectiveModel}"`
  )

  // 環境変数からcwdを取得（デフォルト: "/app/miniapp"）
  const cwd = process.env.CLAUDE_CODE_CWD || '/app/miniapp'
  console.log(`🔍 createQueryOptions - Using cwd: "${cwd}"`)

  const options: Options = {
    maxTurns: 50,
    model: effectiveModel, // Use litellm model_name (not the actual model name)
    systemPrompt:
      'You are an exceptionally skilled and experienced React + TypeScript + PocketBase developer with deep expertise in modern web development. You excel at building elegant, minimal apps with clean, production-ready code. You prioritize simplicity, maintainability, and fewer files while delivering robust functionality. Your solutions are always well-architected and follow best practices.\n\nYou are using the PocketBase MCP Server.',
    cwd: cwd,
    permissionMode: 'acceptEdits',
    // pathToClaudeCodeExecutable: "/toolbox/agent/node_modules/@anthropic-ai/claude-code/cli.js",
    agents: {
      'fsd-checker': {
        description:
          'Specialized agent for reviewing code quality and Feature Sliced Design (FSD) architecture compliance. Use this agent to check layer structure, segment placement, dependency rules, and DDD patterns.',
        prompt: `You are a senior software architect specialized in Feature Sliced Design (FSD) and Domain-Driven Design (DDD).

Your role is to review code and ensure compliance with FSD architecture principles:

## FSD Layer Structure (依存関係: 上位→下位のみ許可)
- **app**: ルーティング・グローバル状態 (最上位レイヤー)
- **pages**: 画面コンポーネント
- **features**: 機能単位のSlice群
- **entities**: ドメインモデル層
- **shared**: 共通コンポーネント・ライブラリ (最下位レイヤー)

## Segment Structure (各レイヤー内)
- **api**: 外部通信・データフェッチング
- **model**: ビジネスロジック (service, usecase, entity)
- **ui**: UIコンポーネント

## 重要なルール
1. **依存関係の方向**: 下位レイヤーは上位レイヤーをimportしてはならない
2. **同一レイヤー内の共通化**: 同一レイヤーで共通利用するコードは下位レイヤーに配置
3. **DDD原則**: service, usecase, entityを適切に分離
4. **PocketBase使用**: 必ず \`@/shared/lib/pocketbase\` から \`pb\` をimport

## チェック項目
- ファイル配置の適切性（Layer/Segment構造）
- import文の依存関係（逆依存チェック）
- 共通コードの配置場所
- DDD原則の適用状況
- PocketBase使用ルールの遵守

レビュー時は具体的な問題箇所とファイルパス、改善提案を提示してください。`,
        tools: ['Read', 'Grep', 'Glob'],
        model: 'inherit',
      },
    },
    hooks: {
      PostToolUse: [
        {
          hooks: [createPostToolUseHook(cwd)],
        },
      ],
      SessionEnd: [
        {
          hooks: [createSessionEndHook(cwd)],
        },
      ],
    },
    mcpServers: {
      pocketbase: {
        type: 'stdio',
        command: 'node',
        args: ['/vercel/sandbox/mcp/pocketbase-mcp/build/index.js'],
        env: {
          POCKETBASE_URL: 'http://127.0.0.1:8090',
          POCKETBASE_ADMIN_EMAIL: 'admin@example.com',
          POCKETBASE_ADMIN_PASSWORD: 'mypassword123',
          POCKETBASE_DATA_DIR: '/vercel/sandbox/pb/pb_data',
        },
      },
      magicuidesign: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@magicuidesign/mcp@latest'],
      },
      shadcn: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'shadcn@canary', 'registry:mcp'],
        env: {
          REGISTRY_URL: 'https://animate-ui.com/r/registry.json',
        },
      },
      context7: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp'],
      },
      playwright: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@playwright/mcp@latest', '--isolated'],
      },
      supabase: {
        type: 'http',
        url: 'http://localhost:54321/mcp',
      }
    },
    allowedTools: [
      'Agent',
      'TodoWrite',
      'TodoRead',
      'Read',
      'Write',
      'Edit',
      'MultiEdit',
      'Bash',
      'Glob',
      'Grep',
      'LS',
      'WebSearch',
      'WebFetch',
      'Bash(rm -f ./)',
      'Bash(pnpm dlx shadcn@latest add:*)',
      'Bash(pnpm dlx shadcn@latest add --overwrite:*)',
      'Bash(pnpm install)',
      'Bash(pnpm install:*)',
      'Bash(pnpm run build)',
      'mcp__pocketbase',
      'mcp__magicuidesign',
      'mcp__shadcn',
      'mcp__context7',
      'mcp__playwright',
    ],
    disallowedTools: [
      // 認証システム関連（絶対変更禁止）
      'Edit(**/shared/lib/pocketbase.ts)',
      'MultiEdit(**/shared/lib/pocketbase.ts)',
      'Write(**/shared/lib/pocketbase.ts)',
      'Edit(**/features/auth/model/useAuth.ts)',
      'MultiEdit(**/features/auth/model/useAuth.ts)',
      'Write(**/features/auth/model/useAuth.ts)',
      'Edit(**/features/auth/ui/LoginForm.tsx)',
      'MultiEdit(**/features/auth/ui/LoginForm.tsx)',
      'Write(**/features/auth/ui/LoginForm.tsx)',
      'Edit(**/features/auth/model/validation.ts)',
      'MultiEdit(**/features/auth/model/validation.ts)',
      'Write(**/features/auth/model/validation.ts)',

      // レイアウト・プロバイダー関連（慎重に変更）
      'Edit(**/app/layout.tsx)',
      'MultiEdit(**/app/layout.tsx)',
      'Write(**/app/layout.tsx)',
      'Edit(**/app/providers/auth-provider.tsx)',
      'MultiEdit(**/app/providers/auth-provider.tsx)',
      'Write(**/app/providers/auth-provider.tsx)',

      // Server Actions（外部API基盤）- 全体を保護
      'Edit(**/shared/server/**)',
      'MultiEdit(**/shared/server/**)',
      'Write(**/shared/server/**)',

      // 既存の認証関連（広範囲の保護）
      'Edit(**/pocketbase.ts)',
      'MultiEdit(**/pocketbase.ts)',
      'Write(**/pocketbase.ts)',
      'Edit(**/features/auth/**)',
      'MultiEdit(**/features/auth/**)',
      'Write(**/features/auth/**)',

      // 危険なコマンド（削除系）
      'Bash(rm -rf)', // -rf 全域
      'Bash(rm -r )', // -r 単独（末尾スペースを意図的に含める例）
      'Bash(rm -R )', // -R 単独
      'Bash(rm -f /)', // 絶対パス直下
      'Bash(rm -f //)', // // 特殊
      'Bash(rm -f ..)', // 親ディレクトリ参照
      'Bash(rm -f ../)', // 親ディレクトリ配下
      'Bash(rm -f ~)', // ホーム配下
      'Bash(rm -f * )', // ワイルドカード（ゆるめのガード）
      'Bash(rm -f */)', // ディレクトリワイルドカード

      // 開発サーバー関連（実行禁止）
      'Bash(pnpm run dev)',
      'Bash(pnpm run preview)',
      'Bash(pnpm run build:watch)',
    ],
  }

  // Add session-related options if sessionId exists
  if (sessionId) {
    ;(options as any).resume = sessionId
    console.log(`🔗 Using session ID for continuity: ${sessionId}`)
  }

  return options
}

// Function to execute npm run build
export async function executeBuild(): Promise<void> {
  try {
    console.log('🔨 Starting npm run build in /app/miniapp...')
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: '/app/miniapp',
      timeout: 300000, // 5 minutes timeout
    })

    if (stdout) {
      console.log('📦 Build output:')
      console.log(stdout)
    }

    if (stderr) {
      console.log('⚠️ Build warnings/errors:')
      console.log(stderr)
    }

    console.log('✅ Build completed successfully')
  } catch (buildError: any) {
    console.error('❌ Build failed:')
    console.error(buildError)

    // Prepare build error details for retry
    const buildOutput = {
      stdout: buildError.stdout || '',
      stderr: buildError.stderr || buildError.message || '',
    }

    const error = new BuildError('Build failed', buildOutput)
    throw error
  }
}

// Function to execute Claude Code session
export async function executeClaudeCode(
  prompt: string,
  queryOptions: Options,
  developmentRecord: DevelopmentRecord
): Promise<string | undefined> {
  let sessionId: string | undefined

  try {
    console.log('🔍 Debug - Query options:')
    console.log(`  Model: ${queryOptions.model}`)
    console.log(`  MaxTurns: ${queryOptions.maxTurns}`)
    console.log(`  CWD: ${queryOptions.cwd}`)
    console.log(`  PermissionMode: ${queryOptions.permissionMode}`)
    console.log('🔍 Debug - Full options object:')
    // console.log(JSON.stringify(queryOptions, null, 2));
    console.log('🔍 Debug - Starting query execution...')
    console.log(
      `🔍 Debug - Prompt: "${prompt.substring(0, 100)}${
        prompt.length > 100 ? '...' : ''
      }"`
    )

    const queryIterator = query({
      prompt: prompt,
      options: queryOptions,
    })

    console.log('🔍 Debug - Query iterator created, starting message loop...')

    for await (const message of queryIterator) {
      console.log(
        `🔍 Debug - Received message type: ${message.type}, subtype: ${
          (message as any).subtype || 'N/A'
        }`
      )
      sessionId = message.session_id
      formatMessage(message)

      // Save message to database
      if (developmentRecord) {
        try {
          // Debug: Check developmentRecord and user_id
          if (!developmentRecord.user_id) {
            console.error('❌ CRITICAL: developmentRecord.user_id is missing!')
            console.error(
              '  developmentRecord:',
              JSON.stringify(developmentRecord, null, 2)
            )
          }

          await saveMessageToDatabase(
            message,
            developmentRecord.id,
            queryOptions.model,
            developmentRecord.user_id
          )
          console.log('✅ Debug - Message saved to database successfully')
        } catch (dbError: any) {
          console.error(
            '❌ Critical - Failed to save message to database:',
            dbError
          )

          let errorMessage = 'Database error during message processing'
          let errorType = 'DATABASE_ERROR'

          if (dbError.name === 'InsufficientCreditError') {
            errorMessage = `Credit insufficient. Current: $${dbError.currentBalance}, Required: $${dbError.requiredCost}`
            errorType = 'INSUFFICIENT_CREDIT'
            console.error(`💳 ${errorMessage}`)
          } else if (dbError.message?.includes('userId is required')) {
            errorMessage = 'Critical error: User ID is missing'
            errorType = 'MISSING_USER_ID'
          } else {
            errorMessage = `Database error: ${dbError.message || 'Unknown error'}`
          }

          // Record error to miniapp_ai_processing table
          try {
            await saveErrorToAIProcessing(
              developmentRecord.id,
              sessionId,
              message.type,
              errorMessage,
              queryOptions.model,
              {
                error_type: errorType,
                original_error: dbError.message,
                stack_trace: dbError.stack,
              }
            )
          } catch (processingError) {
            console.error(
              'Failed to save to miniapp_ai_processing:',
              processingError
            )
          }

          // Update development status to ERROR
          try {
            await updateDevelopmentStatusToError(
              developmentRecord,
              errorMessage,
              sessionId
            )
            console.log('📝 Development status updated to ERROR')
          } catch (updateError) {
            console.error(
              '❌ Failed to update development status to ERROR:',
              updateError
            )
          }

          // Always stop processing on any database error
          throw dbError
        }
      }
    }

    console.log('🔍 Debug - Query execution completed')
    return sessionId
  } catch (queryError) {
    console.log('🔍 Debug - Query error details:')
    console.log(
      `  Error name: ${
        queryError instanceof Error ? queryError.name : 'Unknown'
      }`
    )
    console.log(
      `  Error message: ${
        queryError instanceof Error ? queryError.message : String(queryError)
      }`
    )

    throw queryError
  }
}

// Function to execute a complete development cycle (Claude Code + Build + DB Update)
export async function executeDevelopmentCycle(
  prompt: string,
  sessionId: string | undefined,
  developmentRecord: DevelopmentRecord,
  options?: { model?: string }
): Promise<{
  success: boolean
  sessionId?: string
  buildErrorPrompt?: string
}> {
  try {
    // Create query options
    const queryOptions = createQueryOptions(sessionId, options?.model)

    // Execute Claude Code session
    const newSessionId = await executeClaudeCode(
      prompt,
      queryOptions,
      developmentRecord
    )

    // Execute build
    await executeBuild()

    // Update development status to completed after successful build
    // Note: MiniAppVersion creation is now handled in updateDevelopmentStatusToCompleted
    await updateDevelopmentStatusToCompleted(developmentRecord, newSessionId)

    return { success: true, sessionId: newSessionId }
  } catch (error: any) {
    if (error.name === 'BuildError') {
      // Generate error prompt for build failure retry
      const buildErrorPrompt = `Previous build failed with the following error. Please fix the build issues and ensure the code compiles successfully:

Build Error Details:
${error.buildOutput?.stderr}

${
  error.buildOutput?.stdout
    ? `Build Output:
${error.buildOutput.stdout}`
    : ''
}`

      return {
        success: false,
        sessionId: sessionId,
        buildErrorPrompt,
      }
    }

    // Re-throw other errors
    throw error
  }
}
