import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { fetchAndSaveCollections } from '../utils/pocketbase-collections'
import { createClient } from '@supabase/supabase-js'
import {
  getMiniAppGitCredentials,
  buildGiteaCloneUrl,
  checkMiniAppGitAuthExists,
} from './git-auth'

const execAsync = promisify(exec)

// Initialize Supabase client for Git authentication
const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

let supabase: ReturnType<typeof createClient> | null = null

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn(
    '⚠️ SUPABASE_URL or SUPABASE_ANON_KEY not set - Git authentication will be skipped'
  )
}

/**
 * Git操作のためのヘルパー関数
 */
async function execGitCommand(
  command: string,
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  try {
    console.log(`🔧 Executing: git ${command} in ${cwd}`)
    const { stdout, stderr } = await execAsync(`git ${command}`, {
      cwd,
      timeout: 60000, // 60秒タイムアウト
    })

    if (stdout) {
      console.log(`📝 Git output: ${stdout.trim()}`)
    }

    if (stderr && !stderr.includes('warning:')) {
      console.log(`⚠️ Git stderr: ${stderr.trim()}`)
    }

    return { stdout, stderr }
  } catch (error: any) {
    console.error(`❌ Git command failed: ${command}`, error)
    // エラーオブジェクトにstdoutとstderrを追加して、呼び出し元で詳細を確認可能にする
    const gitError = new Error(`Git command failed: ${error.message}`)
    ;(gitError as any).stdout = error.stdout || ''
    ;(gitError as any).stderr = error.stderr || ''
    throw gitError
  }
}

/**
 * Gitリポジトリの初期化
 */
async function ensureGitRepo(repoPath: string): Promise<void> {
  const gitDir = path.join(repoPath, '.git')

  if (!existsSync(gitDir)) {
    console.log(`📦 Initializing git repository at ${repoPath}`)
    await execGitCommand('init', repoPath)

    // デフォルトのユーザー設定（環境変数から取得可能）
    const userName = process.env.GIT_USER_NAME || 'MiniApp Agent'
    const userEmail = process.env.GIT_USER_EMAIL || 'agent@miniapp.local'

    await execGitCommand(`config user.name "${userName}"`, repoPath)
    await execGitCommand(`config user.email "${userEmail}"`, repoPath)

    console.log(`✅ Git repository initialized`)
  } else {
    console.log(`📦 Git repository already exists at ${repoPath}`)
  }
}

/**
 * リモートリポジトリの設定と認証情報の管理
 * 1. upstreamがない場合はGitHubテンプレートリポジトリを設定
 * 2. originがgithub.com/gitea:3000/未設定の場合は、miniappsテーブルのgit_urlまたはデフォルト値で設定
 * 3. originが正式なgit_url（gitea:3000でもgithub.comでもない）の場合はスキップ
 */
async function ensureRemote(
  repoPath: string,
  miniAppId: string
): Promise<boolean> {
  try {
    // 既存のリモートをチェック
    const { stdout } = await execGitCommand('remote -v', repoPath)

    // upstreamがない場合は追加
    if (!stdout.includes('upstream')) {
      console.log(`📝 Adding upstream template repository...`)
      await execGitCommand(
        `remote add upstream https://github.com/titabash/miniapp-template.git`,
        repoPath
      )
      console.log(`✅ Upstream template repository added`)
    }

    // originが以下の場合は必ず設定/更新：
    // - 未設定
    // - gitea:3000（デフォルト値）
    // - github.com（テンプレートリポジトリ - pushの誤爆防止）
    const hasOrigin = stdout.includes('origin')
    const originNeedsUpdate =
      !hasOrigin ||
      stdout.includes('gitea:3000') ||
      stdout.includes('github.com')

    if (originNeedsUpdate) {
      // Supabaseクライアントが利用可能かチェック
      if (!supabase) {
        console.error(
          `❌ Supabase client not available, cannot setup Git remote`
        )
        return false
      }

      try {
        console.log(`🔐 Setting up Git remote for miniapp ${miniAppId}...`)

        if (stdout.includes('github.com') && hasOrigin) {
          console.warn(
            `⚠️  Origin points to GitHub template - updating to prevent accidental pushes`
          )
        }

        // miniappsテーブルからgit_urlを取得（型エラー回避のためas anyを使用）
        const { data: miniapp, error: miniappError } = await (supabase as any)
          .from('miniapps')
          .select('git_url')
          .eq('id', miniAppId)
          .single()

        if (miniappError) {
          console.error(
            `❌ Failed to get miniapp data: ${miniappError.message}`
          )
          return false
        }

        // git_urlの存在チェック
        const giteaUrl = miniapp?.git_url ?? 'http://gitea:3000'

        if (!miniapp?.git_url) {
          console.warn(
            `⚠️  Git URL not configured for miniapp (${miniAppId}), using default: ${giteaUrl}`
          )
          console.warn(
            `   This will be updated when git_url is properly configured`
          )
        } else {
          console.log(`📦 Using Git URL from database: ${giteaUrl}`)
        }

        // Git認証情報の存在確認
        const authExists = await checkMiniAppGitAuthExists(supabase, miniAppId)

        if (!authExists) {
          console.error(
            `❌ No Git authentication found for miniapp ${miniAppId}`
          )
          console.error(
            `   Cannot setup Git remote without authentication credentials`
          )
          return false
        }

        // 認証情報を取得
        const gitCredentials = await getMiniAppGitCredentials(
          supabase,
          miniAppId
        )

        // 認証情報付きのClone URLを構築
        const cloneUrlWithAuth = buildGiteaCloneUrl(
          giteaUrl,
          gitCredentials.username,
          gitCredentials.password,
          gitCredentials.repoName
        )

        // originリモートを設定/更新（認証情報を含むため、詳細ログは避ける）
        if (hasOrigin) {
          console.log(`🔄 Updating origin remote...`)
          // execGitCommandのログ出力を抑制するため、直接execAsyncを使用
          await execAsync(`git remote set-url origin "${cloneUrlWithAuth}"`, {
            cwd: repoPath,
          })
        } else {
          console.log(`➕ Adding origin remote...`)
          // execGitCommandのログ出力を抑制するため、直接execAsyncを使用
          await execAsync(`git remote add origin "${cloneUrlWithAuth}"`, {
            cwd: repoPath,
          })
        }

        // セキュリティのため、完全なURLはログに出力しない
        const urlParts = new URL(giteaUrl)
        console.log(
          `✅ Origin remote configured: ${urlParts.origin}/${gitCredentials.username}/${gitCredentials.repoName}`
        )
      } catch (gitAuthError) {
        console.error(`❌ Failed to setup Git remote: ${gitAuthError}`)
        return false
      }
    } else {
      // originが正式なgit_url（gitea:3000でもgithub.comでもない）の場合はスキップ
      console.log(
        `✅ Origin remote already properly configured, skipping update`
      )
    }
    return true
  } catch (error) {
    console.error(`⚠️ Failed to check/setup remote: ${error}`)
    return false
  }
}

/**
 * コンフリクトが発生しているファイルのリストを取得
 */
async function getConflictedFiles(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await execGitCommand(
      'diff --name-only --diff-filter=U',
      repoPath
    )
    return stdout
      .trim()
      .split('\n')
      .filter((file) => file.length > 0)
  } catch (error) {
    console.error('Failed to get conflicted files:', error)
    return []
  }
}

/**
 * Claude Codeを使用してコンフリクトを解消
 */
async function resolveConflictsWithAI(
  repoPath: string,
  conflictedFiles: string[]
): Promise<boolean> {
  console.log(
    `🤖 Using AI to resolve conflicts in ${conflictedFiles.length} files`
  )

  // コンフリクトファイルの内容を読み込み
  let conflictDetails = ''
  for (const file of conflictedFiles) {
    const filePath = path.join(repoPath, file)
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8')
      conflictDetails += `\n\nFile: ${file}\n${content}`
    }
  }

  // Claude Code用のプロンプト作成
  const prompt = `以下のGitコンフリクトを解消してください。各ファイルのコンフリクトマーカー（<<<<<<< HEAD、=======、>>>>>>> など）を適切に解消し、最終的なコードが正しく動作するようにしてください。

重要な指針：
1. 両方の変更の意図を理解し、可能な限り両方の変更を統合する
2. 重複するコードは削除する
3. コンフリクトマーカーは完全に削除する
4. 最終的なコードが構文的に正しく、論理的に一貫性があることを確認する

コンフリクトが発生しているファイル:
${conflictedFiles.join('\n')}

詳細:
${conflictDetails}

各ファイルを修正して、コンフリクトを解消してください。`

  // Claude Code実行オプション
  const options: Options = {
    maxTurns: 10,
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4',
    cwd: repoPath,
    permissionMode: 'acceptEdits',
    pathToClaudeCodeExecutable:
      '/toolbox/agent/node_modules/@anthropic-ai/claude-code/cli.js',
    allowedTools: ['Read', 'Edit', 'MultiEdit', 'Write'],
  }

  try {
    console.log('🔧 Starting AI conflict resolution...')
    const queryIterator = query({
      prompt: prompt,
      options: options,
    })

    let success = false
    for await (const message of queryIterator) {
      console.log(`📝 AI: ${message.type}`)

      // result messageで完了を確認
      if (message.type === 'result' && 'subtype' in message) {
        if (message.subtype === 'success') {
          success = true
          console.log('✅ AI successfully resolved conflicts')
        }
      }
    }

    return success
  } catch (error) {
    console.error('❌ AI conflict resolution failed:', error)
    return false
  }
}

/**
 * Gitでコミットを作成し、コンフリクトを自動解消してcommit_hashを返す関数
 */
export async function executeGitCommitWithConflictResolution(
  miniAppId: string
): Promise<{
  commitHash: string | null
  message: string
  hadConflicts: boolean
  success: boolean
  error?: string
}> {
  console.log(`🚀 Starting git commit and push for miniapp ${miniAppId}...`)

  try {
    const repoPath = path.dirname(process.env.CLAUDE_CODE_CWD || '/app/miniapp')

    // ディレクトリの存在確認
    if (!existsSync(repoPath)) {
      throw new Error(`Source directory not found: ${repoPath}`)
    }

    console.log(`📦 Creating commit for miniapp ${miniAppId}`)

    // Gitリポジトリの初期化
    await ensureGitRepo(repoPath)

    // PocketBaseコレクション情報を取得して保存（Git add前）
    console.log('📦 Fetching PocketBase collections before Git commit...')
    await fetchAndSaveCollections()

    // すべての変更をステージング（pc_collection.jsonも含まれる）
    // -A オプションで削除されたファイルも追跡
    await execGitCommand('add -A', repoPath)

    // コミットの作成（変更がある場合のみ）
    let commitHash = ''
    const timestamp = new Date().toISOString()
    const commitMessage = `Update miniapp ${miniAppId} - ${timestamp}`

    try {
      await execGitCommand(`commit -m "${commitMessage}"`, repoPath)
      console.log(`✅ Created local commit`)
    } catch (error: any) {
      // stdoutで「nothing to commit」をチェック（error.messageには含まれないため）
      if (error.stdout?.includes('nothing to commit')) {
        console.log(`ℹ️ No changes to commit, using current HEAD`)
      } else {
        throw error
      }
    }

    // 最終的なコミットハッシュを取得
    const { stdout: hash } = await execGitCommand('rev-parse HEAD', repoPath)
    commitHash = hash.trim()

    // リモートへのプッシュ
    try {
      await execGitCommand('push origin HEAD', repoPath)
      console.log(`📤 Pushed to remote`)
    } catch (error: any) {
      console.error(`❌ Failed to push to remote: ${error}`)
      console.error(`ℹ️ Changes are committed locally but not pushed`)
      return {
        commitHash,
        message: commitMessage,
        hadConflicts: false,
        success: false,
        error: `Git push failed: ${error.message || String(error)}`,
      }
    }

    console.log(
      `✅ Git operations completed successfully with commit: ${commitHash}`
    )

    return {
      commitHash,
      message: commitMessage,
      hadConflicts: false,
      success: true,
    }
  } catch (error: any) {
    console.error('❌ Git commit failed:', error)
    console.error('⚠️ Returning error status but not throwing')

    // Return error status instead of throwing
    return {
      commitHash: null,
      message: '',
      hadConflicts: false,
      success: false,
      error: error.message || String(error),
    }
  }
}

/**
 * シンプルなGitコミット（コンフリクト解消なし）
 */
export async function executeGitCommit(miniAppId: string): Promise<{
  commitHash: string | null
  message: string
  success: boolean
  error?: string
}> {
  const result = await executeGitCommitWithConflictResolution(miniAppId)
  return {
    commitHash: result.commitHash,
    message: result.message,
    success: result.success,
    error: result.error,
  }
}

/**
 * 後方互換性のための関数（既存コードで使用されている場合）
 * @deprecated executeGitCommit を使用してください
 */
export async function executeVersionedRcloneCopy(
  miniAppId: string,
  _version: number
): Promise<{
  paths: {
    reactCodePath?: string
    pocketbaseDataPath?: string
  }
}> {
  console.warn(
    '⚠️ executeVersionedRcloneCopy is deprecated. Using executeGitCommit instead.'
  )

  // Git commitを実行
  const result = await executeGitCommit(miniAppId)

  // エラーがあってもパスを返す（commitHashがnullの場合は代替値を使用）
  const hashOrFallback = result.commitHash || 'no-commit'

  // 後方互換性のため、旧形式のレスポンスを返す
  return {
    paths: {
      reactCodePath: `${miniAppId}/commit/${hashOrFallback}/`,
      pocketbaseDataPath: `${miniAppId}/commit/${hashOrFallback}/pb_migrations/`,
    },
  }
}
