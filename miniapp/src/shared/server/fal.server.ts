import { fal } from "@fal-ai/client";

// Server Functions 用のfal.aiクライアントインスタンス作成
export async function createFalInstance(): Promise<typeof fal> {
  "use server";

  const apiKey = process.env.FAL_KEY;

  if (!apiKey) {
    throw new Error(
      "fal.ai API key が設定されていません。環境変数 FAL_KEY を設定してください。"
    );
  }

  // fal.aiクライアントの設定
  fal.config({
    credentials: apiKey,
  });

  // 開発環境でのログ出力
  if (process.env.NODE_ENV === "development") {
    console.log("[Fal.ai] サーバーインスタンス初期化完了");
  }

  return fal;
}

// fal.ai API呼び出し用の共通エラーハンドリング
export function handleFalError(error: unknown): string {
  "use server";

  if (error instanceof Error) {
    // fal.ai APIエラーの場合
    if ("status" in error && "message" in error) {
      const apiError = error as {
        status?: number;
        message: string;
      };

      switch (apiError.status) {
        case 400:
          return "リクエストが無効です。パラメータを確認してください。";
        case 401:
          return "fal.ai API キーが無効です。";
        case 403:
          return "fal.ai API へのアクセスが拒否されました。";
        case 404:
          return "fal.ai API エンドポイントが見つかりません。";
        case 422:
          return "リクエストの形式が正しくありません。入力データを確認してください。";
        case 429:
          return "fal.ai API の使用制限に達しました。しばらく待ってから再試行してください。";
        case 500:
          return "fal.ai API サーバーエラーが発生しました。";
        case 503:
          return "fal.ai API が一時的に利用できません。";
        default:
          return `fal.ai API エラー: ${apiError.message}`;
      }
    }

    return error.message;
  }

  return "fal.ai API で予期しないエラーが発生しました。";
}

// よく使用されるfal.aiモデル定数
export const FAL_MODELS = {
  // 画像生成モデル
  FLUX_DEV: "fal-ai/flux/dev",
  FLUX_SCHNELL: "fal-ai/flux/schnell",
  FLUX_PRO: "fal-ai/flux-pro",
  STABLE_DIFFUSION_XL: "fal-ai/stable-diffusion-xl",

  // 動画生成モデル
  MINIMAX_VIDEO_TEXT_TO_VIDEO: "fal-ai/minimax-video/text-to-video",
  MINIMAX_VIDEO_IMAGE_TO_VIDEO: "fal-ai/minimax-video/image-to-video",

  // 音声モデル
  WHISPER: "fal-ai/whisper",
} as const;

// 共通のfal.ai設定
export const FAL_CONFIG = {
  // 画像生成のデフォルト設定
  IMAGE_DEFAULTS: {
    model: FAL_MODELS.FLUX_DEV,
    image_size: "square_hd" as const,
    num_images: 1,
    guidance_scale: 3.5,
    num_inference_steps: 28,
  },

  // 高品質画像生成設定
  HIGH_QUALITY_DEFAULTS: {
    model: FAL_MODELS.FLUX_PRO,
    image_size: "landscape_4_3" as const,
    num_images: 1,
    guidance_scale: 3.5,
    num_inference_steps: 50,
  },

  // 高速画像生成設定
  FAST_DEFAULTS: {
    model: FAL_MODELS.FLUX_SCHNELL,
    image_size: "square" as const,
    num_images: 1,
    num_inference_steps: 4,
  },

  // 動画生成のデフォルト設定
  VIDEO_DEFAULTS: {
    model: FAL_MODELS.MINIMAX_VIDEO_TEXT_TO_VIDEO,
    duration: "5s" as const,
    aspect_ratio: "16:9" as const,
  },

  // 音声認識のデフォルト設定
  WHISPER_DEFAULTS: {
    model: FAL_MODELS.WHISPER,
    task: "transcribe" as const,
    language: "ja" as const,
  },
} as const;

// 画像生成用のヘルパー関数
export async function generateImage(
  prompt: string,
  options: {
    model?: string;
    image_size?: string;
    num_images?: number;
    seed?: number;
    guidance_scale?: number;
    num_inference_steps?: number;
  } = {}
) {
  "use server";

  try {
    const fal = await createFalInstance();

    const result = await fal.subscribe(
      options.model || FAL_CONFIG.IMAGE_DEFAULTS.model,
      {
        input: {
          prompt,
          image_size:
            options.image_size || FAL_CONFIG.IMAGE_DEFAULTS.image_size,
          num_images:
            options.num_images || FAL_CONFIG.IMAGE_DEFAULTS.num_images,
          seed: options.seed,
          guidance_scale:
            options.guidance_scale || FAL_CONFIG.IMAGE_DEFAULTS.guidance_scale,
          num_inference_steps:
            options.num_inference_steps ||
            FAL_CONFIG.IMAGE_DEFAULTS.num_inference_steps,
        },
      }
    );

    return {
      success: true,
      data: result.data,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Fal.ai] 画像生成エラー:", error);
    return {
      success: false,
      error: handleFalError(error),
    };
  }
}

// 動画生成用のヘルパー関数
export async function generateVideo(
  prompt: string,
  options: {
    model?: string;
    image_url?: string;
    duration?: string;
    aspect_ratio?: string;
  } = {}
) {
  "use server";

  try {
    const fal = await createFalInstance();

    const modelId = options.image_url
      ? FAL_MODELS.MINIMAX_VIDEO_IMAGE_TO_VIDEO
      : options.model || FAL_CONFIG.VIDEO_DEFAULTS.model;

    const input: Record<string, unknown> = {
      prompt,
      duration: options.duration || FAL_CONFIG.VIDEO_DEFAULTS.duration,
      aspect_ratio:
        options.aspect_ratio || FAL_CONFIG.VIDEO_DEFAULTS.aspect_ratio,
    };

    if (options.image_url) {
      input.image_url = options.image_url;
    }

    const result = await fal.subscribe(modelId, { input });

    return {
      success: true,
      data: result.data,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Fal.ai] 動画生成エラー:", error);
    return {
      success: false,
      error: handleFalError(error),
    };
  }
}

// 音声認識用のヘルパー関数
export async function transcribeAudio(
  audio_url: string,
  options: {
    task?: "transcribe" | "translate";
    language?: string;
    batch_size?: number;
  } = {}
) {
  "use server";

  try {
    const fal = await createFalInstance();

    const result = await fal.subscribe(FAL_MODELS.WHISPER, {
      input: {
        audio_url,
        task: options.task || FAL_CONFIG.WHISPER_DEFAULTS.task,
        language: options.language || FAL_CONFIG.WHISPER_DEFAULTS.language,
        batch_size: options.batch_size || 64,
      },
    });

    return {
      success: true,
      data: result.data,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Fal.ai] 音声認識エラー:", error);
    return {
      success: false,
      error: handleFalError(error),
    };
  }
}

// ファイルアップロード用のヘルパー関数
export async function uploadFile(
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  "use server";

  try {
    const fal = await createFalInstance();

    const url = await fal.storage.upload(file);

    return {
      success: true,
      url,
    };
  } catch (error) {
    console.error("[Fal.ai] ファイルアップロードエラー:", error);
    return {
      success: false,
      error: handleFalError(error),
    };
  }
}

// リアルタイム接続用のヘルパー関数（WebSocket）
export function createRealtimeConnection(
  modelId: string,
  options: {
    onResult?: (result: unknown) => void;
    onError?: (error: unknown) => void;
    connectionKey?: string;
    throttleInterval?: number;
  } = {}
) {
  "use server";

  try {
    const connection = fal.realtime.connect(modelId, {
      onResult:
        options.onResult ||
        ((result) => console.log("[Fal.ai] リアルタイム結果:", result)),
      onError:
        options.onError ||
        ((error) => console.error("[Fal.ai] リアルタイムエラー:", error)),
      connectionKey: options.connectionKey,
      throttleInterval: options.throttleInterval || 128,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[Fal.ai] リアルタイム接続が確立されました");
    }

    return connection;
  } catch (error) {
    console.error("[Fal.ai] リアルタイム接続エラー:", error);
    throw new Error(handleFalError(error));
  }
}
