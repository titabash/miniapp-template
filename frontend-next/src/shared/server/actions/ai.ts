"use server";

import { generateImage, generateVideo, transcribeAudio, uploadFile } from "@/shared/server/lib/fal.server";

// 画像生成 Server Action
export async function generateImageAction(
  prompt: string,
  options?: {
    model?: string;
    image_size?: string;
    num_images?: number;
    seed?: number;
    guidance_scale?: number;
    num_inference_steps?: number;
  }
) {
  return await generateImage(prompt, options);
}

// 動画生成 Server Action
export async function generateVideoAction(
  prompt: string,
  options?: {
    model?: string;
    image_url?: string;
    duration?: string;
    aspect_ratio?: string;
  }
) {
  return await generateVideo(prompt, options);
}

// 音声認識 Server Action
export async function transcribeAudioAction(
  audio_url: string,
  options?: {
    task?: "transcribe" | "translate";
    language?: string;
    batch_size?: number;
  }
) {
  return await transcribeAudio(audio_url, options);
}

// ファイルアップロード Server Action
export async function uploadFileAction(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    return {
      success: false,
      error: "ファイルが選択されていません"
    };
  }
  
  return await uploadFile(file);
}