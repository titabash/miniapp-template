import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// rclone 共通フラグ (rclone_init.shと同じ設定)
const RCLONE_FLAGS = [
  "-L", // シンボリックリンクを実体コピー
  "--local-no-set-modtime", // FUSE で chtimes エラーを回避
  "--exclude",
  "node_modules/**", // node_modules は除外
];

/**
 * バージョン付きパスを生成する関数
 */
function generateVersionedPaths(miniAppId: string, version: number) {
  return {
    reactApp: {
      name: "React アプリ",
      src: "/app/miniapp",
      dst: `/mnt/app/miniapp/${miniAppId}/v${version}`,
      storagePath: `${miniAppId}/v${version}/`,
    },
    pocketbase: {
      name: "PocketBase マイグレーション",
      src: "/pb/pb_migrations",
      dst: `/mnt/pb/pb_migrations/${miniAppId}/v${version}`,
      storagePath: `${miniAppId}/v${version}/`,
    },
  };
}

/**
 * rclone copy を実行する関数
 */
async function copyOnce(src: string, dst: string): Promise<void> {
  const command = `rclone copy ${RCLONE_FLAGS.join(" ")} "${src}" "${dst}"`;

  try {
    console.log(`🔄 rclone copy: ${src} → ${dst}`);
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60秒タイムアウト
    });

    if (stdout) {
      console.log(`📦 rclone copy output: ${stdout}`);
    }

    if (stderr) {
      console.log(`⚠️ rclone copy warnings: ${stderr}`);
    }

    console.log(`✅ rclone copy completed: ${src} → ${dst}`);
  } catch (error: any) {
    console.error(`❌ rclone copy failed: ${src} → ${dst}`, error);
    throw new Error(
      `rclone copy failed from ${src} to ${dst}: ${error.message}`
    );
  }
}

/**
 * バージョン付きでrclone copyを実行する関数（ファイルシステム操作のみ）
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
  console.log(
    `🚀 Starting versioned rclone copy for miniapp ${miniAppId} v${version}...`
  );

  try {
    const versionedPaths = generateVersionedPaths(miniAppId, version);

    console.log(`📦 Creating version ${version} for miniapp ${miniAppId}`);

    // ディレクトリを作成
    await execAsync(`mkdir -p "${versionedPaths.reactApp.dst}"`);
    await execAsync(`mkdir -p "${versionedPaths.pocketbase.dst}"`);

    // ファイルをコピー
    const copyOperations = [
      {
        name: versionedPaths.reactApp.name,
        src: versionedPaths.reactApp.src,
        dst: versionedPaths.reactApp.dst,
        storagePath: versionedPaths.reactApp.storagePath,
      },
      {
        name: versionedPaths.pocketbase.name,
        src: versionedPaths.pocketbase.src,
        dst: versionedPaths.pocketbase.dst,
        storagePath: versionedPaths.pocketbase.storagePath,
      },
    ];

    // ReactアプリとPocketBaseを順次コピー
    for (const operation of copyOperations) {
      console.log(`🔄 Copying ${operation.name}...`);
      await copyOnce(operation.src, operation.dst);
    }

    console.log(
      `✅ All rclone copy operations completed successfully for version ${version}`
    );

    return {
      paths: {
        reactCodePath: versionedPaths.reactApp.storagePath,
        pocketbaseDataPath: versionedPaths.pocketbase.storagePath,
      },
    };
  } catch (error) {
    console.error("❌ rclone copy failed:", error);
    throw error;
  }
}

/**
 * 後方互換性のための関数（既存コードで使用されている場合）
 * @deprecated executeVersionedRcloneCopy を使用してください
 */
export async function executeRcloneSync(): Promise<void> {
  console.warn(
    "⚠️ executeRcloneSync is deprecated. Use executeVersionedRcloneCopy instead."
  );
  throw new Error(
    "executeRcloneSync is deprecated. Please provide miniAppId and use executeVersionedRcloneCopy."
  );
}
