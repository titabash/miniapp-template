import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { query } from "@anthropic-ai/claude-code";
import type { Options } from "@anthropic-ai/claude-code";

const execAsync = promisify(exec);

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
 * リモートリポジトリの設定
 */
async function ensureRemote(
  repoPath: string,
  remoteName: string = "origin"
): Promise<boolean> {
  const remoteUrl = process.env.GIT_REMOTE_URL;

  if (!remoteUrl) {
    console.log(`ℹ️ No GIT_REMOTE_URL configured, skipping remote setup`);
    return false;
  }

  try {
    // 既存のリモートをチェック
    const { stdout } = await execGitCommand("remote -v", repoPath);

    if (stdout.includes(remoteName)) {
      console.log(`📡 Remote '${remoteName}' already configured`);
      // リモートURLを更新（変更があった場合のため）
      await execGitCommand(
        `remote set-url ${remoteName} ${remoteUrl}`,
        repoPath
      );
    } else {
      console.log(`📡 Adding remote '${remoteName}': ${remoteUrl}`);
      await execGitCommand(
        `remote add ${remoteName} ${remoteUrl}`,
        repoPath
      );
    }

    return true;
  } catch (error) {
    console.error(`⚠️ Failed to configure remote: ${error}`);
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
  conflictedFiles: string[],
  miniAppId: string
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
  commitHash: string;
  message: string;
  hadConflicts: boolean;
}> {
  console.log(
    `🚀 Starting git commit with conflict resolution for miniapp ${miniAppId}...`
  );

  try {
    const repoPath = path.resolve(process.cwd(), "miniapp");

    // ディレクトリの存在確認
    if (!existsSync(repoPath)) {
      throw new Error(`Source directory not found: ${repoPath}`);
    }

    console.log(`📦 Creating commit for miniapp ${miniAppId}`);

    // Gitリポジトリの初期化
    await ensureGitRepo(repoPath);

    // リモートの設定
    const hasRemote = await ensureRemote(repoPath);

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

    // すべての変更をステージング
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
            const resolved = await resolveConflictsWithAI(repoPath, conflictedFiles, miniAppId);

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
      hadConflicts
    };
  } catch (error) {
    console.error("❌ Git commit failed:", error);
    throw error;
  }
}

/**
 * シンプルなGitコミット（コンフリクト解消なし）
 */
export async function executeGitCommit(
  miniAppId: string
): Promise<{
  commitHash: string;
  message: string;
}> {
  const result = await executeGitCommitWithConflictResolution(miniAppId);
  return {
    commitHash: result.commitHash,
    message: result.message
  };
}

/**
 * 後方互換性のための関数（既存コードで使用されている場合）
 * @deprecated executeGitCommit を使用してください
 */
export async function executeVersionedRcloneCopy(
  miniAppId: string,
  version: number
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
  const { commitHash } = await executeGitCommit(miniAppId);

  // 後方互換性のため、旧形式のレスポンスを返す
  return {
    paths: {
      reactCodePath: `${miniAppId}/commit/${commitHash}/`,
      pocketbaseDataPath: `${miniAppId}/commit/${commitHash}/pb_migrations/`,
    },
  };
}
