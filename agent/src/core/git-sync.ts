import { exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import path from "path";

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
 * Gitでコミットを作成し、commit_hashを返す関数
 */
export async function executeGitCommit(
  miniAppId: string
): Promise<{
  commitHash: string;
  message: string;
}> {
  console.log(
    `🚀 Starting git commit for miniapp ${miniAppId}...`
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
    
    try {
      const timestamp = new Date().toISOString();
      commitMessage = `Update miniapp ${miniAppId} - ${timestamp}`;
      
      await execGitCommand(
        `commit -m "${commitMessage}"`,
        repoPath
      );
      
      // コミットハッシュを取得
      const { stdout: hash } = await execGitCommand(
        "rev-parse HEAD",
        repoPath
      );
      commitHash = hash.trim();
      
      console.log(`✅ Created commit: ${commitHash}`);
    } catch (error: any) {
      if (error.message.includes("nothing to commit")) {
        console.log(`ℹ️ No changes to commit`);
        // 変更がない場合は現在のHEADのハッシュを返す
        const { stdout: hash } = await execGitCommand(
          "rev-parse HEAD",
          repoPath
        );
        commitHash = hash.trim();
        commitMessage = "No changes";
      } else {
        throw error;
      }
    }
    
    // リモートへのプッシュ（設定されている場合）
    if (hasRemote && commitHash && commitMessage !== "No changes") {
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
      message: commitMessage
    };
  } catch (error) {
    console.error("❌ Git commit failed:", error);
    throw error;
  }
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