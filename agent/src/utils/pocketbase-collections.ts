import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * PocketBase migrate collections - マイグレーション実行
 */

/**
 * PocketBaseのマイグレーションコマンドを実行してコレクション情報を同期
 */
export async function fetchAndSaveCollections(): Promise<void> {
  console.log('🚀 Starting PocketBase migration...')

  try {
    const migrationsDir = `${process.env.CLAUDE_CODE_CWD}/pb_migrations`
    const command = `/vercel/sandbox/pb/bin/pocketbase migrate collections --migrationsDir="${migrationsDir}"`

    console.log(`📦 Executing: ${command}`)
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 })

    if (stdout) {
      console.log(`📝 PocketBase output: ${stdout.trim()}`)
    }

    if (stderr) {
      console.error(`⚠️ PocketBase stderr: ${stderr.trim()}`)
    }

    console.log('✅ PocketBase migration completed successfully')
  } catch (error) {
    // エラーが発生してもGit同期処理は継続するため、エラーログのみ出力
    console.error(
      '⚠️ PocketBase migration failed, but continuing with Git sync:',
      error
    )
    console.error('⚠️ Collections will not be included in this commit')
  }
}
