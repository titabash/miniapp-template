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
import { createPostToolUseHook, createSessionEndHook, createGitSaveSessionEndHook } from './hooks'
import { createAllSubAgents } from './subagents'
import { logger, config, formatError, truncate } from '../../core/logger'

const execAsync = promisify(exec)

// Function to create Claude Code query options
export function createQueryOptions(
  sessionId?: string,
  model?: string
): Options {
  const effectiveModel = model || 'claude-sonnet-4'
  const cwd = process.env.CLAUDE_CODE_CWD || '/app/miniapp'

  logger.debug('⚙️', `Model: ${effectiveModel}`)
  logger.debug('⚙️', `CWD: ${cwd}`)

  const options: Options = {
    maxTurns: 50,
    model: effectiveModel, // Use litellm model_name (not the actual model name)
    systemPrompt:
      `You are an exceptionally skilled and experienced React + TypeScript + PocketBase developer with deep expertise in modern web development. You excel at building elegant, minimal apps with clean, production-ready code. You prioritize simplicity, maintainability, and fewer files while delivering robust functionality. Your solutions are always well-architected and follow best practices.

You are using the PocketBase MCP Server.

IMPORTANT: When you create, update, or delete PocketBase collections or fields, ALWAYS invoke the 'pocketbase-schema-sync' subagent afterwards to export the updated schema to ${cwd}/collections/pb_collection.json.

IMPORTANT: 重要な作業の区切り（機能実装完了、バグ修正完了、リファクタリング完了など）では、'git-saver' サブエージェントを呼び出して適切なコミットメッセージでgit commit・pushを実行してください。セッション終了時には自動的にgit保存されますが、作業中の適切なタイミングでの保存も重要です。`,
    cwd: cwd,
    permissionMode: 'acceptEdits',
    // pathToClaudeCodeExecutable: "/toolbox/agent/node_modules/@anthropic-ai/claude-code/cli.js",
    agents: createAllSubAgents(cwd),
    hooks: {
      PostToolUse: [
        {
          hooks: [createPostToolUseHook(cwd)],
        },
      ],
      SessionEnd: [
        {
          hooks: [createSessionEndHook(cwd), createGitSaveSessionEndHook(cwd)],
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
    logger.debug('🔗', `Resuming session: ${sessionId}`)
  }

  return options
}

// Function to execute npm run build
export async function executeBuild(): Promise<void> {
  try {
    const cwd = process.env.CLAUDE_CODE_CWD || '/app/miniapp'
    logger.info('🔨', `Starting build in ${cwd}...`)
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: cwd,
      timeout: 300000, // 5 minutes timeout
    })

    if (stdout) {
      logger.debug('📦', 'Build output:')
      logger.debug('📦', stdout)
    }

    if (stderr) {
      logger.debug('⚠️', 'Build warnings:')
      logger.debug('⚠️', stderr)
    }

    logger.info('✅', 'Build completed successfully')
  } catch (buildError: any) {
    formatError('Build failed', buildError)

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
    logger.debug('⚙️', `Query options: Model=${queryOptions.model}, MaxTurns=${queryOptions.maxTurns}, PermissionMode=${queryOptions.permissionMode}`)

    if (config.showPrompt) {
      logger.debug('📝', `Prompt: ${prompt}`)
    } else {
      logger.debug('📝', `Prompt: ${truncate(prompt, 150)}`)
    }

    logger.info('🚀', 'Starting Claude Code execution...')

    const queryIterator = query({
      prompt: prompt,
      options: queryOptions,
    })

    for await (const message of queryIterator) {
      logger.debug('📨', `Message: ${message.type}${(message as any).subtype ? ` (${(message as any).subtype})` : ''}`)
      sessionId = message.session_id
      formatMessage(message)

      // Save message to database
      if (developmentRecord) {
        try {
          // Validation check
          if (!developmentRecord.user_id) {
            logger.error('❌', 'CRITICAL: developmentRecord.user_id is missing!')
            logger.error('❌', JSON.stringify(developmentRecord, null, 2))
          }

          await saveMessageToDatabase(
            message,
            developmentRecord.id,
            queryOptions.model,
            developmentRecord.user_id
          )
          logger.debug('✅', 'Message saved to database')
        } catch (dbError: any) {
          let errorMessage = 'Database error during message processing'
          let errorType = 'DATABASE_ERROR'

          if (dbError.name === 'InsufficientCreditError') {
            errorMessage = `Credit insufficient. Current: $${dbError.currentBalance}, Required: $${dbError.requiredCost}`
            errorType = 'INSUFFICIENT_CREDIT'
          } else if (dbError.message?.includes('userId is required')) {
            errorMessage = 'Critical error: User ID is missing'
            errorType = 'MISSING_USER_ID'
          } else {
            errorMessage = `Database error: ${dbError.message || 'Unknown error'}`
          }

          // Format error with emphasis
          formatError('Database save failed', dbError, {
            message_type: message.type,
            session_id: sessionId,
            error_type: errorType,
          })

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
            logger.error('❌', 'Failed to save to miniapp_ai_processing:', processingError)
          }

          // Update development status to ERROR
          try {
            await updateDevelopmentStatusToError(
              developmentRecord,
              errorMessage,
              sessionId
            )
            logger.info('📝', 'Development status updated to ERROR')
          } catch (updateError) {
            logger.error('❌', 'Failed to update development status to ERROR:', updateError)
          }

          // Always stop processing on any database error
          throw dbError
        }
      }
    }

    logger.debug('✅', 'Query execution completed')
    return sessionId
  } catch (queryError) {
    formatError('Query execution failed', queryError)
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
