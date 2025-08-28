import PocketBase from "pocketbase";

// Server Functions 用の新しいPocketBaseインスタンス作成（リクエスト毎に独立）
export async function createPocketBaseInstance(): Promise<PocketBase> {
  "use server";

  const pb = new PocketBase(
    process.env.POCKETBASE_URL || "http://127.0.0.1:8090"
  );

  // 認証情報の自動リフレッシュを無効化（サーバー用途）
  pb.autoCancellation(false);

  return pb;
}
