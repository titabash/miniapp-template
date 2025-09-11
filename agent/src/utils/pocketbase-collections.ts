import { promises as fs } from "fs";
import path from "path";
import PocketBase from "pocketbase";

/**
 * PocketBase APIクライアント - コレクション情報取得用
 */

// PocketBase設定
const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://localhost:8090";
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "admin@example.com";
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "mypassword123";

// 出力先パス
const OUTPUT_DIR = "/app/miniapp/collections";
const OUTPUT_FILE = "pb_collection.json";

/**
 * コレクション情報をJSONファイルに保存
 */
async function saveCollectionsToFile(collections: any[]): Promise<void> {
  try {
    // ディレクトリが存在しない場合は作成
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const filePath = path.join(OUTPUT_DIR, OUTPUT_FILE);

    // JSONとして整形して保存（既存ファイルは上書き）
    const jsonContent = JSON.stringify(collections, null, 2);
    await fs.writeFile(filePath, jsonContent, "utf-8");

    console.log(`✅ Saved ${collections.length} collections to ${filePath}`);
  } catch (error) {
    console.error("❌ Failed to save collections to file:", error);
    throw error;
  }
}

/**
 * PocketBaseからコレクション情報を取得してファイルに保存
 */
export async function fetchAndSaveCollections(): Promise<void> {
  console.log("🚀 Starting PocketBase collection export...");

  try {
    // PocketBaseクライアントを初期化
    const pb = new PocketBase(POCKETBASE_URL);

    // 1. SuperUser認証
    console.log(`🔐 Authenticating with PocketBase at ${POCKETBASE_URL}...`);
    const authResult = await pb.collection("_superusers").authWithPassword(
      POCKETBASE_ADMIN_EMAIL,
      POCKETBASE_ADMIN_PASSWORD
    );
    console.log(`✅ Authenticated as superuser: ${authResult.record.email}`);

    // 2. すべてのコレクションを取得（getFullList使用）
    console.log("📦 Fetching all collections from PocketBase...");
    const collections = await pb.collections.getFullList({ sort: '-created' });
    console.log(`✅ Fetched ${collections.length} collections`);

    // 3. ファイルに保存
    await saveCollectionsToFile(collections);

    console.log("✅ PocketBase collection export completed successfully");
  } catch (error) {
    // エラーが発生してもGit同期処理は継続するため、エラーログのみ出力
    console.error("⚠️ PocketBase collection export failed, but continuing with Git sync:", error);
    console.error("⚠️ Collections will not be included in this commit");
  }
}

/**
 * コレクション情報ファイルが存在するか確認
 */
export async function collectionFileExists(): Promise<boolean> {
  try {
    const filePath = path.join(OUTPUT_DIR, OUTPUT_FILE);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
