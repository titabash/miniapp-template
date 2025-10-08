import { exec } from 'child_process'
import { promisify } from 'util'
import type { HookInput } from '@anthropic-ai/claude-agent-sdk'

const execAsync = promisify(exec)

/**
 * PostToolUse hook factory: Write/Edit ツール実行後に prettier でフォーマット
 */
export function createPostToolUseHook(cwd: string) {
  return async function postToolUseHook(
    input: HookInput,
    _toolUseID: string | undefined,
    _options: { signal: AbortSignal }
  ) {
    // PostToolUseの場合のみ処理
    if (input.hook_event_name !== 'PostToolUse') {
      return { continue: true }
    }

    const toolName = input.tool_name

    // Write または Edit ツールの場合のみ処理
    if (toolName !== 'Write' && toolName !== 'Edit') {
      return { continue: true }
    }

    // ファイルパスを取得
    const toolInput = input.tool_input as any
    const filePath = toolInput?.file_path

    if (!filePath || typeof filePath !== 'string') {
      return { continue: true }
    }

    // cwd 配下のファイルのみ対象
    if (!filePath.startsWith(cwd)) {
      return { continue: true }
    }

    try {
      console.log(`🎨 Running prettier on: ${filePath}`)
      await execAsync(`prettier --write "${filePath}"`, {
        cwd: cwd,
        timeout: 30000, // 30秒タイムアウト
      })
      console.log(`✅ Prettier completed: ${filePath}`)
    } catch (error: any) {
      console.error(`⚠️ Prettier failed for ${filePath}:`, error.message)
      // エラーが発生してもフローは継続
    }

    return { continue: true }
  }
}

/**
 * SessionEnd hook factory: セッション終了時に pnpm run build を実行
 */
export function createSessionEndHook(cwd: string) {
  return async function sessionEndHook(
    input: HookInput,
    _toolUseID: string | undefined,
    _options: { signal: AbortSignal }
  ) {
    // SessionEndの場合のみ処理
    if (input.hook_event_name !== 'SessionEnd') {
      return { continue: true }
    }

    try {
      console.log('🔨 SessionEnd: Running pnpm run build...')
      const { stdout, stderr } = await execAsync('pnpm run build', {
        cwd: cwd,
        timeout: 300000, // 5分タイムアウト
      })

      if (stdout) {
        console.log('📦 Build output:')
        console.log(stdout)
      }

      if (stderr) {
        console.log('⚠️ Build warnings:')
        console.log(stderr)
      }

      console.log('✅ Build completed successfully')
    } catch (error: any) {
      console.error('❌ Build failed:', error.message)
      if (error.stdout) {
        console.error('Build stdout:', error.stdout)
      }
      if (error.stderr) {
        console.error('Build stderr:', error.stderr)
      }
      // エラーが発生してもフローは継続
    }

    return { continue: true }
  }
}
