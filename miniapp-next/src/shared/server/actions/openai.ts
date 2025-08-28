"use server";

import { createOpenAIInstance, OPENAI_CONFIG } from "@/shared/server/lib/openai.server";

// チャット補完 Server Action
export async function createChatCompletionAction(
  messages: Array<{ role: string; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  }
) {
  try {
    const openai = await createOpenAIInstance();

    const response = await openai.chat.completions.create({
      ...OPENAI_CONFIG.CHAT_DEFAULTS,
      ...options,
      messages: messages as any,
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error("[OpenAI] チャット補完エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "チャット補完でエラーが発生しました",
    };
  }
}

// 高性能推論タスク Server Action
export async function createReasoningCompletionAction(
  messages: Array<{ role: string; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    reasoning_effort?: string;
  }
) {
  try {
    const openai = await createOpenAIInstance();

    const response = await openai.chat.completions.create({
      ...OPENAI_CONFIG.REASONING_DEFAULTS,
      ...options,
      messages: messages as any,
      reasoning_effort: (options?.reasoning_effort as any) || OPENAI_CONFIG.REASONING_DEFAULTS.reasoning_effort,
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error("[OpenAI] 推論補完エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "推論補完でエラーが発生しました",
    };
  }
}

// 軽量タスク Server Action
export async function createLightweightCompletionAction(
  messages: Array<{ role: string; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }
) {
  try {
    const openai = await createOpenAIInstance();

    const response = await openai.chat.completions.create({
      ...OPENAI_CONFIG.LIGHTWEIGHT_DEFAULTS,
      ...options,
      messages: messages as any,
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error("[OpenAI] 軽量補完エラー:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "軽量補完でエラーが発生しました",
    };
  }
}