import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { query } from "@anthropic-ai/claude-code";
import type { Options } from "@anthropic-ai/claude-code";
import { fetchAndSaveCollections } from "../utils/pocketbase-collections";
import { createClient } from "@supabase/supabase-js";
import {
  getMiniAppGitCredentials,
  buildGiteaCloneUrl,
  checkMiniAppGitAuthExists
} from "./git-auth";

const execAsync = promisify(exec);

// Initialize Supabase client for Git authentication
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn("⚠️ SUPABASE_URL or SUPABASE_ANON_KEY not set - Git authentication will be skipped");
}

/**
 * Git操作のためのヘルパー関数
 */
async function execGitCommand(
  command: string,
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  try {
    console.log(`🔧 Executing: git ${command} in ${cwd}`);
    const { stdout, stderr } = await execAsync(`git ${command}`, {
      cwd,
      timeout: 60000, // 60秒タイムアウト
    });

    if (stdout) {
      console.log(`📝 Git output: ${stdout.trim()}`);
    }

    if (stderr && !stderr.includes("warning:")) {
      console.log(`⚠️ Git stderr: ${stderr.trim()}`);
    }

    return { stdout, stderr };
  } catch (error: any) {
    console.error(`❌ Git command failed: ${command}`, error);
    throw new Error(`Git command failed: ${error.message}`);
  }
}

/**
 * Gitリポジトリの初期化
 */
async function ensureGitRepo(repoPath: string): Promise<void> {
  const gitDir = path.join(repoPath, ".git");

  if (!existsSync(gitDir)) {
    console.log(`📦 Initializing git repository at ${repoPath}`);
    await execGitCommand("init", repoPath);

    // デフォルトのユーザー設定（環境変数から取得可能）
    const userName = process.env.GIT_USER_NAME || "MiniApp Agent";
    const userEmail = process.env.GIT_USER_EMAIL || "agent@miniapp.local";

    await execGitCommand(`config user.name "${userName}"`, repoPath);
    await execGitCommand(`config user.email "${userEmail}"`, repoPath);

    console.log(`✅ Git repository initialized`);
  } else {
    console.log(`📦 Git repository already exists at ${repoPath}`);
  }
}

/**
 * リモートリポジトリの設定と認証情報の管理
 * 1. Northflankエンドポイントが既に設定されている場合はそのまま使用
 * 2. miniappsテーブルからgit_urlを取得し、無い場合はエラー
 * 3. git_urlがある場合はGitea認証情報をデータベースから取得してoriginに設定
 */
async function ensureRemote(
  repoPath: string,
  miniAppId: string
): Promise<boolean> {
  try {
    // 既存のリモートをチェック
    const { stdout } = await execGitCommand("remote -v", repoPath);

    // 既にNorthflankエンドポイントが設定されているかチェック
    const hasNorthflankOrigin = stdout.includes("origin") &&
                               (stdout.includes("northflank.app") || stdout.includes("git.railway.app"));

    if (hasNorthflankOrigin) {
      console.log(`📡 Northflank endpoint already configured as origin, skipping Gitea setup`);
      return true;
    }

    // upstreamにGitHubテンプレートリポジトリが設定されているかチェック
    const hasUpstream = stdout.includes("upstream") &&
                       stdout.includes("https://github.com/");

    if (!hasUpstream) {
      console.log(`ℹ️ No upstream template repository configured, skip pushing`);
      return false;
    }

    // Supabaseクライアントが利用可能かチェック
    if (!supabase) {
      console.error(`❌ Supabase client not available, cannot setup Git remote`);
      return false;
    }

    try {
      console.log(`🔐 Setting up Git remote for miniapp ${miniAppId}...`);

      // miniappsテーブルからgit_urlを取得（型エラー回避のためas anyを使用）
      const { data: miniapp, error: miniappError } = await (supabase as any)
        .from("miniapps")
        .select("git_url")
        .eq("id", miniAppId)
        .single();

      if (miniappError) {
        console.error(`❌ Failed to get miniapp data: ${miniappError.message}`);
        return false;
      }

      // git_urlの存在チェック
      if (!miniapp?.git_url) {
        console.error(`❌ Git URL is not configured for this miniapp (${miniAppId})`);
        console.error(`   Please ensure the miniapp has been properly set up with a Git service`);
        return false;
      }

      const giteaUrl = miniapp.git_url;
      console.log(`📦 Found Git URL for miniapp: ${giteaUrl}`);

      // Git認証情報の存在確認
      const authExists = await checkMiniAppGitAuthExists(supabase, miniAppId);

      if (!authExists) {
        console.error(`❌ No Git authentication found for miniapp ${miniAppId}`);
        console.error(`   Cannot setup Git remote without authentication credentials`);
        return false;
      }

      // 認証情報を取得
      const gitCredentials = await getMiniAppGitCredentials(supabase, miniAppId);

      // 認証情報付きのClone URLを構築
      const cloneUrlWithAuth = buildGiteaCloneUrl(
        giteaUrl,
        gitCredentials.username,
        gitCredentials.password,
        gitCredentials.repoName
      );

      // originリモートを設定/更新（認証情報を含むため、詳細ログは避ける）
      if (stdout.includes("origin")) {
        console.log(`🔄 Updating origin remote to Gitea repository...`);
        // execGitCommandのログ出力を抑制するため、直接execAsyncを使用
        await execAsync(`git remote set-url origin "${cloneUrlWithAuth}"`, { cwd: repoPath });
      } else {
        console.log(`➕ Adding origin remote for Gitea repository...`);
        // execGitCommandのログ出力を抑制するため、直接execAsyncを使用
        await execAsync(`git remote add origin "${cloneUrlWithAuth}"`, { cwd: repoPath });
      }

      // セキュリティのため、完全なURLはログに出力しない
      const urlParts = new URL(giteaUrl);
      console.log(`✅ Origin remote configured for Gitea: ${urlParts.origin}/${gitCredentials.username}/${gitCredentials.repoName}`);

      return true;
    } catch (gitAuthError) {
      console.error(`❌ Failed to setup Gitea remote: ${gitAuthError}`);
      return false;
    }
  } catch (error) {
    console.error(`⚠️ Failed to check/setup remote: ${error}`);
    return false;
  }
}

/**
 * コンフリクトが発生しているファイルのリストを取得
 */
async function getConflictedFiles(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await execGitCommand("diff --name-only --diff-filter=U", repoPath);
    return stdout.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    console.error("Failed to get conflicted files:", error);
    return [];
  }
}

/**
 * Claude Codeを使用してコンフリクトを解消
 */
async function resolveConflictsWithAI(
  repoPath: string,
  conflictedFiles: string[]
): Promise<boolean> {
  console.log(`🤖 Using AI to resolve conflicts in ${conflictedFiles.length} files`);

  // コンフリクトファイルの内容を読み込み
  let conflictDetails = "";
  for (const file of conflictedFiles) {
    const filePath = path.join(repoPath, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      conflictDetails += `\n\nFile: ${file}\n${content}`;
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

各ファイルを修正して、コンフリクトを解消してください。`;

  // Claude Code実行オプション
  const options: Options = {
    maxTurns: 10,
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4",
    cwd: repoPath,
    permissionMode: "acceptEdits",
    pathToClaudeCodeExecutable: "/toolbox/agent/node_modules/@anthropic-ai/claude-code/cli.js",
    allowedTools: [
      "Read",
      "Edit",
      "MultiEdit",
      "Write",
    ],
  };

  try {
    console.log("🔧 Starting AI conflict resolution...");
    const queryIterator = query({
      prompt: prompt,
      options: options,
    });

    let success = false;
    for await (const message of queryIterator) {
      console.log(`📝 AI: ${message.type}`);

      // result messageで完了を確認
      if (message.type === "result" && "subtype" in message) {
        if (message.subtype === "success") {
          success = true;
          console.log("✅ AI successfully resolved conflicts");
        }
      }
    }

    return success;
  } catch (error) {
    console.error("❌ AI conflict resolution failed:", error);
    return false;
  }
}

/**
 * Gitでコミットを作成し、コンフリクトを自動解消してcommit_hashを返す関数
 */
export async function executeGitCommitWithConflictResolution(
  miniAppId: string
): Promise<{
  commitHash: string | null;
  message: string;
  hadConflicts: boolean;
  success: boolean;
  error?: string;
}> {
  console.log(
    `🚀 Starting git commit with conflict resolution for miniapp ${miniAppId}...`
  );

  try {
    const repoPath = "/app";

    // ディレクトリの存在確認
    if (!existsSync(repoPath)) {
      throw new Error(`Source directory not found: ${repoPath}`);
    }

    console.log(`📦 Creating commit for miniapp ${miniAppId}`);

    // Gitリポジトリの初期化
    await ensureGitRepo(repoPath);

    // リモートの設定とGitea認証情報の管理
    const hasRemote = await ensureRemote(repoPath, miniAppId);

    // リモートから最新を取得（リモートがある場合）
    if (hasRemote) {
      try {
        console.log("📥 Fetching latest from remote...");
        await execGitCommand("fetch origin main", repoPath);
      } catch (error) {
        console.log("ℹ️ Could not fetch from remote (may not exist yet)");
      }
    }

    // 現在のブランチを取得
    const { stdout: currentBranch } = await execGitCommand(
      "rev-parse --abbrev-ref HEAD",
      repoPath
    );
    const isMainBranch = currentBranch.trim() === "main" || currentBranch.trim() === "master";

    // mainブランチが存在しない場合は作成
    if (!isMainBranch) {
      try {
        await execGitCommand("checkout -b main", repoPath);
      } catch (error) {
        // すでにmainブランチが存在する場合はチェックアウト
        await execGitCommand("checkout main", repoPath);
      }
    }

    // PocketBaseコレクション情報を取得して保存（Git add前）
    console.log("📦 Fetching PocketBase collections before Git commit...");
    await fetchAndSaveCollections();

    // すべての変更をステージング（pc_collection.jsonも含まれる）
    await execGitCommand("add .", repoPath);

    // コミットの作成（変更がある場合のみ）
    let commitHash = "";
    let commitMessage = "";
    let hadConflicts = false;

    try {
      const timestamp = new Date().toISOString();
      commitMessage = `Update miniapp ${miniAppId} - ${timestamp}`;

      await execGitCommand(
        `commit -m "${commitMessage}"`,
        repoPath
      );

      console.log(`✅ Created local commit`);
    } catch (error: any) {
      if (error.message.includes("nothing to commit")) {
        console.log(`ℹ️ No changes to commit`);
      } else {
        throw error;
      }
    }

    // リモートからプル（マージ）を試行
    if (hasRemote) {
      try {
        console.log("📥 Pulling from remote...");
        await execGitCommand("pull origin main --no-rebase", repoPath);
        console.log("✅ Successfully pulled from remote");
      } catch (pullError: any) {
        if (pullError.message.includes("CONFLICT")) {
          console.log("⚠️ Merge conflicts detected!");
          hadConflicts = true;

          // コンフリクトファイルを取得
          const conflictedFiles = await getConflictedFiles(repoPath);
          console.log(`📝 Conflicted files: ${conflictedFiles.join(', ')}`);

          if (conflictedFiles.length > 0) {
            // AIでコンフリクト解消を試行
            const resolved = await resolveConflictsWithAI(repoPath, conflictedFiles);

            if (resolved) {
              // 解消したファイルをステージング
              await execGitCommand("add .", repoPath);

              // コンフリクト解消のコミット
              const conflictMessage = `Resolved merge conflicts for miniapp ${miniAppId}`;
              await execGitCommand(
                `commit -m "${conflictMessage}"`,
                repoPath
              );

              console.log("✅ Conflicts resolved and committed");
              commitMessage = conflictMessage;
            } else {
              // AI解消が失敗した場合、マージを中止
              await execGitCommand("merge --abort", repoPath);
              throw new Error("Failed to resolve conflicts automatically");
            }
          }
        } else if (pullError.message.includes("no tracking information")) {
          console.log("ℹ️ No remote branch to pull from yet");
        } else {
          throw pullError;
        }
      }
    }

    // 最終的なコミットハッシュを取得
    const { stdout: hash } = await execGitCommand(
      "rev-parse HEAD",
      repoPath
    );
    commitHash = hash.trim();

    // リモートへのプッシュ（設定されている場合）
    if (hasRemote && commitHash) {
      try {
        // mainブランチをプッシュ
        await execGitCommand("push origin main", repoPath);
        console.log(`📤 Pushed to remote`);
      } catch (error) {
        console.error(`⚠️ Failed to push to remote: ${error}`);
        console.log(`ℹ️ Changes are committed locally`);
      }
    }

    console.log(
      `✅ Git operations completed successfully with commit: ${commitHash}`
    );

    return {
      commitHash,
      message: commitMessage,
      hadConflicts,
      success: true
    };
  } catch (error: any) {
    console.error("❌ Git commit failed:", error);
    console.error("⚠️ Returning error status but not throwing");
    
    // Return error status instead of throwing
    return {
      commitHash: null,
      message: "",
      hadConflicts: false,
      success: false,
      error: error.message || String(error)
    };
  }
}

/**
 * シンプルなGitコミット（コンフリクト解消なし）
 */
export async function executeGitCommit(
  miniAppId: string
): Promise<{
  commitHash: string | null;
  message: string;
  success: boolean;
  error?: string;
}> {
  const result = await executeGitCommitWithConflictResolution(miniAppId);
  return {
    commitHash: result.commitHash,
    message: result.message,
    success: result.success,
    error: result.error
  };
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
    reactCodePath?: string;
    pocketbaseDataPath?: string;
  };
}> {
  console.warn(
    "⚠️ executeVersionedRcloneCopy is deprecated. Using executeGitCommit instead."
  );

  // Git commitを実行
  const result = await executeGitCommit(miniAppId);
  
  // エラーがあってもパスを返す（commitHashがnullの場合は代替値を使用）
  const hashOrFallback = result.commitHash || "no-commit";

  // 後方互換性のため、旧形式のレスポンスを返す
  return {
    paths: {
      reactCodePath: `${miniAppId}/commit/${hashOrFallback}/`,
      pocketbaseDataPath: `${miniAppId}/commit/${hashOrFallback}/pb_migrations/`,
    },
  };
}
