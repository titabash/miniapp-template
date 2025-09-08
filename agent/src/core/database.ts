import { createClient } from "@supabase/supabase-js";
import type {
  DevelopmentRecord,
  Message,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
} from "./types";
import { executeGitCommit } from "./git-sync";
import llmPriceData from "../const/llm_price.json" with { type: "json" };

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Calculate token cost based on model and token counts with strict pricing validation
export function calculateTokenCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number = 0,
  cacheReadTokens: number = 0
): number {
  const models = llmPriceData.models as any;
  const profitMultiplier = llmPriceData.profit_multiplier;
  
  // Find model in pricing data - NO FALLBACK, STRICT VALIDATION
  const model = models[modelName];
  if (!model) {
    throw new Error(`❌ CRITICAL: Model "${modelName}" not found in pricing data. This affects revenue calculation. Add proper pricing configuration.`);
  }
  
  // Validate required pricing fields
  validateModelPricingConfig(model, modelName);
  
  return calculateModelSpecificCost(model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, profitMultiplier);
}

// Strict validation of model pricing configuration
function validateModelPricingConfig(model: any, modelName: string): void {
  const requiredFields = ['input_per_1k_usd', 'output_per_1k_usd', 'provider'];
  
  for (const field of requiredFields) {
    if (model[field] === undefined || model[field] === null) {
      throw new Error(`❌ CRITICAL: Model "${modelName}" missing required pricing field "${field}". This affects revenue calculation.`);
    }
  }
  
  // Validate cache pricing if cache tokens are provided
  if (model.cache_creation_per_1k_usd === undefined && model.provider) {
    throw new Error(`❌ CRITICAL: Model "${modelName}" missing "cache_creation_per_1k_usd". Cannot calculate cache creation cost accurately.`);
  }
  
  if (model.cache_read_per_1k_usd === undefined && model.provider) {
    throw new Error(`❌ CRITICAL: Model "${modelName}" missing "cache_read_per_1k_usd". Cannot calculate cache read cost accurately.`);
  }
  
  // Validate Gemini tiered pricing
  if (model.input_per_1k_usd_small && !model.input_per_1k_usd_large) {
    throw new Error(`❌ CRITICAL: Model "${modelName}" has incomplete tiered pricing configuration.`);
  }
}

// Model-specific cost calculation with NO FALLBACKS - strict pricing only
function calculateModelSpecificCost(
  model: any,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
  profitMultiplier: number
): number {
  let inputCost = 0;
  let outputCost = 0;
  let cacheCreationCost = 0;
  let cacheReadCost = 0;

  // Calculate input/output costs based on model configuration
  if (model.input_per_1k_usd_small && model.input_per_1k_usd_large) {
    // Gemini tiered pricing - both fields must be present (validated above)
    const contextThreshold = model.context_threshold_tokens || 200000;
    const totalContextTokens = inputTokens + cacheCreationTokens;
    const isLargeContext = totalContextTokens > contextThreshold;
    
    const inputRate = isLargeContext ? model.input_per_1k_usd_large : model.input_per_1k_usd_small;
    const outputRate = isLargeContext ? model.output_per_1k_usd_large : model.output_per_1k_usd_small;
    const cacheReadRate = isLargeContext ? model.cache_read_per_1k_usd_large : model.cache_read_per_1k_usd_small;
    
    inputCost = inputTokens / 1000 * inputRate;
    outputCost = outputTokens / 1000 * outputRate;
    cacheCreationCost = cacheCreationTokens / 1000 * inputRate; // Gemini: cache creation at input rate
    cacheReadCost = cacheReadTokens / 1000 * cacheReadRate;
  } else {
    // Standard pricing for OpenAI/Anthropic models - all fields must be configured
    inputCost = inputTokens / 1000 * model.input_per_1k_usd;
    outputCost = outputTokens / 1000 * model.output_per_1k_usd;
    cacheCreationCost = cacheCreationTokens / 1000 * model.cache_creation_per_1k_usd;
    cacheReadCost = cacheReadTokens / 1000 * model.cache_read_per_1k_usd;
  }
  
  const totalCost = (inputCost + outputCost + cacheCreationCost + cacheReadCost) * profitMultiplier;
  
  console.log(`💰 STRICT Cost calculation for ${model.upstream_id || 'unknown'} (${model.provider || 'unknown'}):`);
  console.log(`  Input tokens: ${inputTokens} = $${inputCost.toFixed(8)}`);
  console.log(`  Output tokens: ${outputTokens} = $${outputCost.toFixed(8)}`);
  console.log(`  Cache creation tokens: ${cacheCreationTokens} = $${cacheCreationCost.toFixed(8)}`);
  console.log(`  Cache read tokens: ${cacheReadTokens} = $${cacheReadCost.toFixed(8)}`);
  console.log(`  Subtotal: $${(inputCost + outputCost + cacheCreationCost + cacheReadCost).toFixed(8)}`);
  console.log(`  Profit multiplier: ${profitMultiplier}x`);
  console.log(`  FINAL COST: $${totalCost.toFixed(8)}`);
  
  return totalCost;
}

// Type guard functions
function isUserMessage(message: Message): message is SDKUserMessage {
  return message.type === "user";
}

function isAssistantMessage(message: Message): message is SDKAssistantMessage {
  return message.type === "assistant";
}

function isResultMessage(message: Message): message is SDKResultMessage {
  return message.type === "result";
}

function isSystemMessage(message: Message): message is SDKSystemMessage {
  return message.type === "system";
}

// Helper function to update development status to ERROR
export async function updateDevelopmentStatusToError(
  developmentRecord: any,
  errorMessage?: string,
  sessionId?: string
) {
  if (!developmentRecord) {
    console.log("⚠️ No development record to update");
    return;
  }

  try {
    console.log(
      `📝 Updating development status to ERROR for record: ${developmentRecord.id}`
    );
    console.log(`📝 Error message: ${errorMessage || "No error message"}`);

    const updateData: any = {
      status: "ERROR",
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (sessionId) {
      updateData.session_id = sessionId;
      console.log(`📝 Including session_id: ${sessionId}`);
    }

    const { data, error: updateError } = await supabase
      .from("miniapp_development")
      .update(updateData)
      .eq("id", developmentRecord.id)
      .select();

    if (updateError) {
      console.error(
        "Failed to update development status to ERROR:",
        updateError
      );
      console.error("Error details:", JSON.stringify(updateError, null, 2));
    } else {
      console.log("📝 Development status successfully updated to ERROR");
      console.log("Updated record:", data);
    }
  } catch (dbError) {
    console.error("Failed to update development status to ERROR:", dbError);
  }
}

// Helper function to create MiniAppDevelopment record (always creates new record)
export async function createDevelopmentRecord(
  miniAppId: string,
  userId: string,
  userInstruction: string
): Promise<DevelopmentRecord> {
  const now = new Date().toISOString();

  // デバッグ: 関数内で受け取った値を確認
  console.log(`🔍 createDevelopmentRecord - Parameters:`);
  console.log(`  miniAppId: "${miniAppId}"`);
  console.log(`  userId: "${userId}"`);
  console.log(
    `  userInstruction (first 100 chars): "${userInstruction?.substring(
      0,
      100
    )}..."`
  );

  // Always create new record for each session
  console.log(`📝 Creating new development record for miniapp: ${miniAppId}`);
  const { data, error } = await supabase
    .from("miniapp_development")
    .insert({
      id: crypto.randomUUID(),
      miniapp_id: miniAppId,
      user_id: userId,
      user_instruction: userInstruction,
      status: "PROCESSING",
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating development record:", error);
    throw error;
  }
  return data;
}

// Helper function to update development record with result data
async function updateDevelopmentWithResultData(
  developmentId: string,
  totalCostUsd?: number,
  durationMs?: number,
  numTurns?: number
) {
  try {
    const updateData: any = {};

    if (totalCostUsd !== undefined) {
      updateData.total_cost_usd = totalCostUsd;
    }

    if (durationMs !== undefined) {
      updateData.duration_ms = durationMs;
    }

    if (numTurns !== undefined) {
      updateData.num_turns = numTurns;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("miniapp_development")
        .update(updateData)
        .eq("id", developmentId);

      if (error) {
        console.error("Failed to update development with result data:", error);
      } else {
        console.log(
          `📊 Updated development record with cost: $${totalCostUsd}, duration: ${durationMs}ms, turns: ${numTurns}`
        );
      }
    }
  } catch (error) {
    console.error("Error updating development with result data:", error);
  }
}

// Helper function to save message to database
export async function saveMessageToDatabase(
  message: Message,
  developmentId: string,
  llmModel?: string,
  userId?: string
) {
  let contentText: string | null = null;
  let result: any = null;
  let metadata: any = null;
  let subtype = (message as any).subtype || null;

  // Usage token extraction
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let cacheCreationInputTokens: number | null = null;
  let cacheReadInputTokens: number | null = null;

  // Extract content text and prepare metadata based on message type
  if (isAssistantMessage(message)) {
    if (message.message?.content) {
      const textContent = message.message.content
        .filter((content: any) => content.type === "text")
        .map((content: any) => content.text)
        .join("\n");
      contentText = textContent || null;

      // Set subtype based on content types
      const contentTypes = message.message.content.map(
        (content: any) => content.type
      );
      if (contentTypes.includes("tool_use")) {
        subtype = "tool_use";
      } else if (contentTypes.includes("text")) {
        subtype = "text";
      }
    }

    // Extract usage tokens for assistant messages
    if (message.message?.usage) {
      inputTokens = message.message.usage.input_tokens || null;
      outputTokens = message.message.usage.output_tokens || null;
      cacheCreationInputTokens =
        message.message.usage.cache_creation_input_tokens || null;
      cacheReadInputTokens =
        message.message.usage.cache_read_input_tokens || null;
    }

    metadata = {
      full_message: message, // query関数から取得した完全なメッセージオブジェクトを追加
    };
  } else if (isUserMessage(message)) {
    if (message.message?.content) {
      const textContent = message.message.content
        .filter((content: any) => content.type === "text")
        .map((content: any) => content.text)
        .join("\n");
      contentText = textContent || null;

      // Set subtype based on content types
      const contentTypes = message.message.content.map(
        (content: any) => content.type
      );
      if (contentTypes.includes("tool_result")) {
        subtype = "tool_result";
      } else if (contentTypes.includes("text")) {
        subtype = "text";
      }
    }
    metadata = {
      full_message: message, // query関数から取得した完全なメッセージオブジェクトを追加
    };
  } else if (isResultMessage(message)) {
    subtype = message.subtype;

    // result property only exists for success subtype
    if (message.subtype === "success" && "result" in message) {
      result = message.result;
    } else {
      result = null;
    }

    // Extract usage tokens for result messages
    if (message.usage) {
      inputTokens = message.usage.input_tokens || null;
      outputTokens = message.usage.output_tokens || null;
      cacheCreationInputTokens =
        message.usage.cache_creation_input_tokens || null;
      cacheReadInputTokens = message.usage.cache_read_input_tokens || null;
    }

    metadata = {
      full_message: message, // query関数から取得した完全なメッセージオブジェクトを追加
    };

    // Update development record with total cost and duration for result messages
    await updateDevelopmentWithResultData(
      developmentId,
      message.total_cost_usd,
      message.duration_ms,
      message.num_turns
    );
  } else if (isSystemMessage(message)) {
    subtype = message.subtype;
    metadata = {
      full_message: message, // query関数から取得した完全なメッセージオブジェクトを追加
    };
  }

  // Extract is_error based on message type
  let isError: boolean | null = null;
  if (isResultMessage(message)) {
    // For ResultMessage, is_error is a direct property
    isError = message.is_error;
  } else if (
    (isUserMessage(message) || isAssistantMessage(message)) &&
    message.message?.content
  ) {
    // For other message types, check content array
    isError =
      message.message.content.some(
        (content: any) => content.is_error === true
      ) || null;
  }

  // Calculate cost if we have token data
  let costAmount = 0;
  const hasTokenData = inputTokens !== null && outputTokens !== null && (inputTokens > 0 || outputTokens > 0);
  
  if (hasTokenData && llmModel) {
    costAmount = calculateTokenCost(
      llmModel,
      inputTokens || 0,
      outputTokens || 0,
      cacheCreationInputTokens || 0,
      cacheReadInputTokens || 0
    );
    console.log(`💰 Calculated cost: $${costAmount.toFixed(8)} for user ${userId}`);
  } else {
    console.log(`💰 No cost calculation: hasTokenData=${hasTokenData}, llmModel=${llmModel}`);
  }

  // Always use RPC function for all message processing
  console.log(`🏦 Using RPC function for message processing and credit deduction`);
  console.log(`🏦 RPC parameters:`);
  console.log(`  p_user_id: ${userId}`);
  console.log(`  p_cost_amount: ${costAmount}`);

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'deduct_user_credit_and_record_processing',
    {
      p_user_id: userId,
      p_development_id: developmentId,
      p_session_id: message.session_id,
      p_message_type: message.type,
      p_cost_amount: costAmount,
      p_subtype: subtype,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_cache_creation_input_tokens: cacheCreationInputTokens,
      p_cache_read_input_tokens: cacheReadInputTokens,
      p_llm_model: llmModel,
      p_content_text: contentText,
      p_result: result,
      p_is_error: isError,
      p_metadata: metadata
    }
  );

  if (rpcError) {
    console.error("❌ RPC function error:", rpcError);
    throw rpcError;
  }

  if (!rpcResult.success) {
    console.error("❌ RPC function failed:", rpcResult.error);
    
    // If it's insufficient credit, throw a specific error
    if (rpcResult.error === 'Insufficient credit balance') {
      const error = new Error(`Insufficient credit balance. Current: $${rpcResult.current_balance}, Required: $${rpcResult.required_cost}`);
      error.name = 'InsufficientCreditError';
      (error as any).currentBalance = rpcResult.current_balance;
      (error as any).requiredCost = rpcResult.required_cost;
      (error as any).processingId = rpcResult.processing_id;
      throw error;
    } else {
      throw new Error(rpcResult.error);
    }
  }

  if (costAmount > 0) {
    console.log(`💾 Saved message with credit deduction: $${costAmount.toFixed(8)}`);
    console.log(`💰 New user balance: $${rpcResult.new_balance}`);
  } else {
    console.log(`💾 Saved message without cost deduction (cost: $${costAmount})`);
  }
  console.log(`📄 Processing ID: ${rpcResult.processing_id}`);
}

// Function to update development status to completed
export async function updateDevelopmentStatusToCompleted(
  developmentRecord: DevelopmentRecord,
  sessionId?: string
) {
  try {
    // 1. Execute git commit
    console.log(
      `🚀 Creating git commit for miniapp ${developmentRecord.miniapp_id}...`
    );
    const { commitHash, message } = await executeGitCommit(
      developmentRecord.miniapp_id
    );
    
    console.log(
      `📦 Created commit ${commitHash} for miniapp ${developmentRecord.miniapp_id}`
    );

    // 2. Update development status to completed with commit_hash
    const updateData: any = {
      status: "COMPLETED",
      commit_hash: commitHash,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (sessionId) {
      updateData.session_id = sessionId;
      console.log(`📝 Including session_id: ${sessionId}`);
    }

    const { data, error: updateError } = await supabase
      .from("miniapp_development")
      .update(updateData)
      .eq("id", developmentRecord.id)
      .select();

    if (updateError) {
      console.error("Failed to update development status:", updateError);
      console.error("Error details:", JSON.stringify(updateError, null, 2));
    } else {
      console.log("📝 Development status updated to COMPLETED");
      console.log("Updated record:", data);
      console.log(
        `✅ Commit ${commitHash} created and development completed`
      );
    }
  } catch (dbError) {
    console.error("Failed to update development status:", dbError);
  }
}

// Function to get previous session ID for resume functionality
export async function getPreviousSessionId(
  miniAppId: string
): Promise<string | null> {
  try {
    console.log(`🔍 Looking for previous session for miniapp: ${miniAppId}`);
    const { data: latestDevelopment, error: fetchError } = await supabase
      .from("miniapp_development")
      .select("session_id")
      .eq("miniapp_id", miniAppId)
      .not("session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!fetchError && latestDevelopment?.session_id) {
      console.log(
        `🔗 Found previous session ID: ${latestDevelopment.session_id}`
      );
      return latestDevelopment.session_id;
    } else {
      console.log("🆕 No previous session found");
      return null;
    }
  } catch (error) {
    console.log("⚠️ Could not retrieve previous session");
    return null;
  }
}

