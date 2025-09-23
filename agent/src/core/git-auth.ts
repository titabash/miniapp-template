/**
 * MiniApp Git認証情報管理ライブラリ
 * 各MiniAppのGitea認証情報の生成、暗号化、取得を行う
 * weavoプロジェクトのgit-auth.tsから移植・適応
 */

import { createClient } from "@supabase/supabase-js";

// 暗号化/復号化のためのキー（環境変数から取得）
const ENCRYPTION_KEY = process.env.GIT_AUTH_ENCRYPTION_KEY || "miniapp-git-auth-encryption-key-2024";

/**
 * 簡易的な暗号化関数
 * 本番環境では適切な暗号化ライブラリを使用すること
 */
async function encryptPassword(password: string): Promise<string> {
  // 簡易XOR暗号化（本番では適切な暗号化を使用）
  const encoder = new TextEncoder();

  const passwordBytes = encoder.encode(password);
  const keyBytes = encoder.encode(ENCRYPTION_KEY);

  const encrypted = new Uint8Array(passwordBytes.length);
  for (let i = 0; i < passwordBytes.length; i++) {
    encrypted[i] = passwordBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  // Base64エンコード
  return btoa(String.fromCharCode(...encrypted));
}

/**
 * 簡易的な復号化関数
 */
async function decryptPassword(encryptedPassword: string): Promise<string> {
  try {
    // Base64デコード
    const encrypted = new Uint8Array(
      atob(encryptedPassword).split('').map(char => char.charCodeAt(0))
    );

    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(ENCRYPTION_KEY);

    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
    }

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error(`パスワードの復号化に失敗しました: ${error}`);
  }
}

/**
 * MiniApp用のGitパスワードを生成
 */
function generateGitPassword(miniAppId: string): string {
  const miniAppPrefix = miniAppId.substring(0, 8);
  const timestamp = Date.now().toString(36).substring(-6);
  const random = crypto.randomUUID().substring(0, 8);

  return `miniapp-${miniAppPrefix}-${timestamp}-${random}`;
}

/**
 * Git認証情報の型定義
 */
export interface GitCredentials {
  username: string;
  password: string;
  repoName: string;
}

/**
 * Gitea URL構築のヘルパー関数
 */
export function buildGiteaCloneUrl(
  giteaUrl: string,
  username: string,
  password: string,
  repoName: string
): string {
  // URLからプロトコルとホストを分離
  const url = new URL(giteaUrl);
  const protocol = url.protocol;
  const host = url.host;

  // 認証情報付きのclone URLを構築
  return `${protocol}//${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}/${username}/${repoName}.git`;
}

/**
 * MiniAppのGit認証情報を作成してデータベースに保存
 * @returns 生成されたGit認証情報（username, password）
 */
export async function createMiniAppGitAuth(
  supabase: ReturnType<typeof createClient>,
  miniAppId: string,
  username: string = "frontend-app",
  repoName: string = "react-app"
): Promise<{ username: string; password: string; repoName: string }> {
  try {
    console.log(`🔐 Creating Git auth for MiniApp: ${miniAppId}`);

    // パスワード生成
    const password = generateGitPassword(miniAppId);
    const encryptedPassword = await encryptPassword(password);

    console.log(`🔑 Generated Git credentials for ${miniAppId}`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password.substring(0, 8)}... (first 8 chars)`);
    console.log(`   Repository: ${repoName}`);

    // データベースに保存（型エラー回避のためas anyを使用）
    const { error } = await supabase
      .from('miniapp_git_auth')
      .insert({
        id: crypto.randomUUID(), // UUIDを明示的に生成
        miniapp_id: miniAppId,
        username: username,
        password_encrypted: encryptedPassword,
        repo_name: repoName,
        expires_at: null // 無期限
      } as any);

    if (error) {
      console.error(`❌ Failed to save Git auth for ${miniAppId}:`, error);
      throw new Error(`Git認証情報の保存に失敗しました: ${error.message}`);
    }

    console.log(`✅ Git auth created successfully for MiniApp: ${miniAppId}`);

    // 生成した認証情報を返す（Giteaに渡すため）
    return {
      username: username,
      password: password,
      repoName: repoName
    };
  } catch (error) {
    console.error(`❌ Error creating Git auth for ${miniAppId}:`, error);
    throw error;
  }
}

/**
 * MiniAppのGit認証情報を取得
 */
export async function getMiniAppGitCredentials(
  supabase: ReturnType<typeof createClient>,
  miniAppId: string
): Promise<GitCredentials> {
  try {
    console.log(`🔍 Getting Git credentials for MiniApp: ${miniAppId}`);

    // 認証情報のみを取得（型エラー回避のためas anyを使用）
    const { data, error } = await (supabase as any)
      .from('miniapp_git_auth')
      .select('username, password_encrypted, repo_name')
      .eq('miniapp_id', miniAppId)
      .single();

    if (error) {
      console.error(`❌ Failed to get Git auth for ${miniAppId}:`, error);
      throw new Error(`Git認証情報の取得に失敗しました: ${error.message}`);
    }

    if (!data) {
      throw new Error(`MiniApp ${miniAppId} のGit認証情報が見つかりません`);
    }

    // パスワード復号化
    const password = await decryptPassword(data.password_encrypted);

    console.log(`✅ Git credentials retrieved for MiniApp: ${miniAppId}`);
    console.log(`👤 Username: ${data.username}`);
    console.log(`🔑 Password: ${password.substring(0, 8)}... (first 8 chars)`);
    console.log(`📦 Repository: ${data.repo_name}`);

    return {
      username: data.username,
      password: password,
      repoName: data.repo_name
    };
  } catch (error) {
    console.error(`❌ Error getting Git credentials for ${miniAppId}:`, error);
    throw error;
  }
}

/**
 * MiniAppのGit認証情報を更新
 */
export async function updateMiniAppGitAuth(
  supabase: ReturnType<typeof createClient>,
  miniAppId: string,
  updates: {
    username?: string;
    password?: string;
    repoName?: string;
  }
): Promise<void> {
  try {
    console.log(`🔄 Updating Git auth for MiniApp: ${miniAppId}`);

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.username) {
      updateData.username = updates.username;
    }

    if (updates.password) {
      updateData.password_encrypted = await encryptPassword(updates.password);
    }

    if (updates.repoName) {
      updateData.repo_name = updates.repoName;
    }

    const { error } = await (supabase as any)
      .from('miniapp_git_auth')
      .update(updateData)
      .eq('miniapp_id', miniAppId);

    if (error) {
      console.error(`❌ Failed to update Git auth for ${miniAppId}:`, error);
      throw new Error(`Git認証情報の更新に失敗しました: ${error.message}`);
    }

    console.log(`✅ Git auth updated successfully for MiniApp: ${miniAppId}`);
  } catch (error) {
    console.error(`❌ Error updating Git auth for ${miniAppId}:`, error);
    throw error;
  }
}

/**
 * MiniAppのGit認証情報を削除
 */
export async function deleteMiniAppGitAuth(
  supabase: ReturnType<typeof createClient>,
  miniAppId: string
): Promise<void> {
  try {
    console.log(`🗑️ Deleting Git auth for MiniApp: ${miniAppId}`);

    const { error } = await (supabase as any)
      .from('miniapp_git_auth')
      .delete()
      .eq('miniapp_id', miniAppId);

    if (error) {
      console.error(`❌ Failed to delete Git auth for ${miniAppId}:`, error);
      throw new Error(`Git認証情報の削除に失敗しました: ${error.message}`);
    }

    console.log(`✅ Git auth deleted successfully for MiniApp: ${miniAppId}`);
  } catch (error) {
    console.error(`❌ Error deleting Git auth for ${miniAppId}:`, error);
    throw error;
  }
}

/**
 * Git認証情報の存在確認
 */
export async function checkMiniAppGitAuthExists(
  supabase: ReturnType<typeof createClient>,
  miniAppId: string
): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any)
      .from('miniapp_git_auth')
      .select('id')
      .eq('miniapp_id', miniAppId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
      console.error(`❌ Error checking Git auth for ${miniAppId}:`, error);
      throw new Error(`Git認証情報の確認に失敗しました: ${error.message}`);
    }

    return !!data;
  } catch (error) {
    console.error(`❌ Error checking Git auth existence for ${miniAppId}:`, error);
    return false;
  }
}