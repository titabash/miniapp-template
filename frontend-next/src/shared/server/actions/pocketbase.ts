"use server";

import { createPocketBaseInstance } from "@/shared/server/lib/pocketbase.server";

// PocketBase コレクション操作 Server Action
export async function getRecordsAction(
  collection: string,
  options?: {
    page?: number;
    perPage?: number;
    sort?: string;
    filter?: string;
    expand?: string;
  }
) {
  try {
    const pb = await createPocketBaseInstance();
    
    const result = await pb.collection(collection).getList(
      options?.page || 1,
      options?.perPage || 50,
      {
        sort: options?.sort,
        filter: options?.filter,
        expand: options?.expand,
      }
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[PocketBase] レコード取得エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "レコード取得でエラーが発生しました",
    };
  }
}

// レコード作成 Server Action
export async function createRecordAction(
  collection: string,
  data: Record<string, any>
) {
  try {
    const pb = await createPocketBaseInstance();
    
    const record = await pb.collection(collection).create(data);

    return {
      success: true,
      data: record,
    };
  } catch (error) {
    console.error("[PocketBase] レコード作成エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "レコード作成でエラーが発生しました",
    };
  }
}

// レコード更新 Server Action
export async function updateRecordAction(
  collection: string,
  id: string,
  data: Record<string, any>
) {
  try {
    const pb = await createPocketBaseInstance();
    
    const record = await pb.collection(collection).update(id, data);

    return {
      success: true,
      data: record,
    };
  } catch (error) {
    console.error("[PocketBase] レコード更新エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "レコード更新でエラーが発生しました",
    };
  }
}

// レコード削除 Server Action
export async function deleteRecordAction(collection: string, id: string) {
  try {
    const pb = await createPocketBaseInstance();
    
    await pb.collection(collection).delete(id);

    return {
      success: true,
      data: { id },
    };
  } catch (error) {
    console.error("[PocketBase] レコード削除エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "レコード削除でエラーが発生しました",
    };
  }
}