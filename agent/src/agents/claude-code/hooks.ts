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

/**
 * SessionEnd Git Save hook factory: セッション終了時に git add/commit/push を実行
 */
export function createGitSaveSessionEndHook(cwd: string) {
  return async function gitSaveSessionEndHook(
    input: HookInput,
    _toolUseID: string | undefined,
    _options: { signal: AbortSignal }
  ) {
    // SessionEndの場合のみ処理
    if (input.hook_event_name !== 'SessionEnd') {
      return { continue: true }
    }

    try {
      console.log('💾 SessionEnd: Saving to Git...')

      // Git add all changes
      await execAsync('git add -A', {
        cwd: cwd,
        timeout: 30000,
      })
      console.log('✅ git add -A completed')

      // Check if there are changes to commit
      try {
        await execAsync('git diff --cached --quiet', {
          cwd: cwd,
          timeout: 10000,
        })
        console.log('ℹ️ No changes to commit')
        return { continue: true }
      } catch {
        // Exit code 1 means there are changes - proceed with commit
      }

      // Commit with timestamp
      const timestamp = new Date().toISOString()
      const commitMessage = `Auto-save: セッション終了 ${timestamp}`
      await execAsync(`git commit -m "${commitMessage}"`, {
        cwd: cwd,
        timeout: 30000,
      })
      console.log(`✅ git commit completed: ${commitMessage}`)

      // Push to remote
      await execAsync('git push origin HEAD', {
        cwd: cwd,
        timeout: 60000, // 1分タイムアウト
      })
      console.log('✅ git push completed')

    } catch (error: any) {
      console.error('❌ Git save failed:', error.message)
      if (error.stdout) {
        console.error('Git stdout:', error.stdout)
      }
      if (error.stderr) {
        console.error('Git stderr:', error.stderr)
      }
      // エラーが発生してもフローは継続
    }

    return { continue: true }
  }
}
