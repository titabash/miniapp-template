import {
  Codex,
  type CodexOptions,
  type ThreadOptions,
  type ThreadEvent,
} from '@openai/codex-sdk'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import type { DevelopmentRecord } from '../../core/types'
import { BuildError } from '../../core/types'
import {
  saveMessageToDatabase,
  saveErrorToAIProcessing,
  updateDevelopmentStatusToCompleted,
  updateDevelopmentStatusToError,
} from '../../core/database'

const execAsync = promisify(exec)

// Function to create Codex instance with config
export function createCodexInstance(model?: string): Codex {
  console.log(`🔍 createCodexInstance - Model: "${model || 'default'}"`)

  // Set CODEX_HOME environment variable to point to our config directory
  const configDir = path.resolve(__dirname)
  process.env.CODEX_HOME = configDir
  console.log(`🔍 Using config directory: ${configDir}`)

  const codexOptions: CodexOptions = {
    apiKey: process.env.OPENAI_API_KEY,
  }

  // Support LiteLLM proxy if configured
  if (process.env.OPENAI_BASE_URL) {
    codexOptions.baseUrl = process.env.OPENAI_BASE_URL
    console.log(`🔍 Using custom base URL: ${codexOptions.baseUrl}`)
  }

  return new Codex(codexOptions)
}

// Function to create Codex Thread options
export function createThreadOptions(model?: string): ThreadOptions {
  console.log(`🔍 createThreadOptions - Received model: "${model}"`)

  const effectiveModel = model || 'gpt-5-codex'
  console.log(
    `🔍 createThreadOptions - Using effective model: "${effectiveModel}"`
  )

  // 環境変数からcwdを取得（デフォルト: "/app/miniapp"）
  const cwd = process.env.CODEX_CWD || '/app/miniapp'
  console.log(`🔍 createThreadOptions - Using cwd: "${cwd}"`)

  const options: ThreadOptions = {
    workingDirectory: cwd,
    skipGitRepoCheck: true,
    model: effectiveModel,
    sandboxMode: 'workspace-write', // Allow file modifications
  }

  return options
}

// Function to execute npm run build
export async function executeBuild(): Promise<void> {
  try {
    const cwd = process.env.CODEX_CWD || process.env.CLAUDE_CODE_CWD || '/app/miniapp'
    console.log(`🔨 Starting npm run build in ${cwd}...`)
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: cwd,
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

    const buildOutput = {
      stdout: buildError.stdout || '',
      stderr: buildError.stderr || buildError.message || '',
    }

    const error = new BuildError('Build failed', buildOutput)
    throw error
  }
}

// Function to execute Codex session
export async function executeCodex(
  prompt: string,
  codex: Codex,
  threadId: string | undefined,
  developmentRecord: DevelopmentRecord,
  options: { model?: string }
): Promise<string | undefined> {
  let currentThreadId: string | undefined = threadId

  try {
    console.log('🔍 Debug - Codex options:')
    console.log(`  Model: ${options.model}`)
    console.log(`  Thread ID: ${threadId || 'new thread'}`)

    // Start or resume thread
    const thread = threadId
      ? codex.resumeThread(threadId, createThreadOptions(options.model))
      : codex.startThread(createThreadOptions(options.model))

    console.log('🔍 Debug - Starting Codex execution...')
    console.log(
      `🔍 Debug - Prompt: "${prompt.substring(0, 100)}${
        prompt.length > 100 ? '...' : ''
      }"`
    )

    // Run with streaming
    const { events } = await thread.runStreamed(prompt)

    for await (const event of events) {
      console.log(`🔍 Debug - Received event type: ${event.type}`)

      // Extract thread_id from ThreadStartedEvent
      if (event.type === 'thread.started') {
        currentThreadId = event.thread_id
        console.log(`🔗 Thread started with ID: ${currentThreadId}`)
      }

      // Save events to database
      if (developmentRecord) {
        try {
          if (!developmentRecord.user_id) {
            console.error('❌ CRITICAL: developmentRecord.user_id is missing!')
            console.error(
              '  developmentRecord:',
              JSON.stringify(developmentRecord, null, 2)
            )
          }

          // Use current thread ID (from event or thread object)
          const effectiveThreadId = currentThreadId || thread.id || undefined

          // Convert Codex event to message format compatible with database
          const message = {
            type: event.type,
            session_id: effectiveThreadId,
            data: event,
          }

          await saveMessageToDatabase(
            message as any,
            developmentRecord.id,
            options.model || 'gpt-4o',
            developmentRecord.user_id
          )
          console.log('✅ Debug - Event saved to database successfully')
        } catch (dbError: any) {
          console.error(
            '❌ Critical - Failed to save event to database:',
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

          const effectiveThreadId = currentThreadId || thread.id || undefined

          try {
            await saveErrorToAIProcessing(
              developmentRecord.id,
              effectiveThreadId,
              event.type,
              errorMessage,
              options.model || 'gpt-4o',
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

          try {
            await updateDevelopmentStatusToError(
              developmentRecord,
              errorMessage,
              effectiveThreadId
            )
            console.log('📝 Development status updated to ERROR')
          } catch (updateError) {
            console.error(
              '❌ Failed to update development status to ERROR:',
              updateError
            )
          }

          throw dbError
        }
      }
    }

    console.log('🔍 Debug - Codex execution completed')
    // Return the thread ID, converting null to undefined
    return currentThreadId || thread.id || undefined
  } catch (codexError) {
    console.log('🔍 Debug - Codex error details:')
    console.log(
      `  Error name: ${
        codexError instanceof Error ? codexError.name : 'Unknown'
      }`
    )
    console.log(
      `  Error message: ${
        codexError instanceof Error ? codexError.message : String(codexError)
      }`
    )

    throw codexError
  }
}

// Function to execute a complete development cycle (Codex + Build + DB Update)
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
    // Create Codex instance (uses config.toml in same directory)
    const codex = createCodexInstance(options?.model)

    // Execute Codex session
    const newSessionId = await executeCodex(
      prompt,
      codex,
      sessionId,
      developmentRecord,
      { model: options?.model }
    )

    // Execute build
    await executeBuild()

    // Update development status to completed after successful build
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
