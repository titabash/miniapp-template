import { query } from "@anthropic-ai/claude-code";
import { exec } from "child_process";
import { promisify } from "util";
import type { Options } from "@anthropic-ai/claude-code";
import type { DevelopmentRecord } from "../../core/types.ts";
import { BuildError } from "../../core/types.ts";
import {
  saveMessageToDatabase,
  updateDevelopmentStatusToCompleted,
  updateDevelopmentStatusToError,
} from "../../core/database.ts";
import { formatMessage } from "../../core/formatter.ts";

const execAsync = promisify(exec);

// Function to create Claude Code query options
export function createQueryOptions(
  sessionId?: string,
  model?: string
): Options {
  // デバッグ: モデル指定の確認
  console.log(`🔍 createQueryOptions - Received model: "${model}"`);

  // modelが指定されていない場合はlitellm.config.yamlのmodel_nameを使用
  const effectiveModel = model || "claude-sonnet-4";
  console.log(
    `🔍 createQueryOptions - Using effective model: "${effectiveModel}"`
  );

  const options: Options = {
    maxTurns: 50,
    model: effectiveModel, // Use litellm model_name (not the actual model name)
    customSystemPrompt:
      "You are an exceptionally skilled and experienced React + TypeScript + PocketBase developer with deep expertise in modern web development. You excel at building elegant, minimal apps with clean, production-ready code. You prioritize simplicity, maintainability, and fewer files while delivering robust functionality. Your solutions are always well-architected and follow best practices.",
    appendSystemPrompt: "You are using the PocketBase MCP Server.",
    cwd: "/app/miniapp",
    permissionMode: "acceptEdits",
    pathToClaudeCodeExecutable: "/app/agent/node_modules/@anthropic-ai/claude-code/cli.js",
    mcpServers: {
      pocketbase: {
        type: "stdio",
        command: "node",
        args: ["/mcp/pocketbase-mcp/build/index.js"],
        env: {
          POCKETBASE_URL: "http://127.0.0.1:8090",
          POCKETBASE_ADMIN_EMAIL: "admin@example.com",
          POCKETBASE_ADMIN_PASSWORD: "mypassword123",
          POCKETBASE_DATA_DIR: "/pb/pb_data",
        },
      },
      magicuidesign: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@magicuidesign/mcp@latest"],
      },
      shadcn: {
        type: "stdio",
        command: "npx",
        args: ["-y", "shadcn@canary", "registry:mcp"],
        env: {
          REGISTRY_URL: "https://animate-ui.com/r/registry.json",
        },
      },
      context7: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@upstash/context7-mcp"],
      },
      playwright: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest", "--isolated"],
      },
    },
    allowedTools: [
      "Agent",
      "TodoWrite",
      "TodoRead",
      "Read",
      "Write",
      "Edit",
      "MultiEdit",
      "Bash",
      "Glob",
      "Grep",
      "LS",
      "WebSearch",
      "WebFetch",
      "Bash(rm -f ./)",
      "Bash(npx shadcn@latest add:*)",
      "Bash(npx shadcn@latest add --overwrite:*)",
      "Bash(npm install:*)",
      "Bash(npm run build)",
      "mcp__pocketbase",
      "mcp__magicuidesign",
      "mcp__shadcn",
      "mcp__context7",
      "mcp__playwright",
    ],
    disallowedTools: [
      "Edit(**/pocketbase.ts)",
      "MultiEdit(**/pocketbase.ts)",
      "Write(**/pocketbase.ts)",
      "Edit(**/features/auth/**)",
      "MultiEdit(**/features/auth/**)",
      "Write(**/features/auth/**)",
      "Write(**/App.tsx)",
      "Edit(**/App.tsx)",
      "MultiEdit(**/App.tsx)",
      "Write(**/main.tsx)",
      "Edit(**/main.tsx)",
      "MultiEdit(**/main.tsx)",
      "Edit(**/shared/server/lib/**)",
      "MultiEdit(**/shared/server/lib/**)",
      "Write(**/shared/server/lib/**)",
      "Bash(rm -rf)",           // -rf 全域
      "Bash(rm -r )",           // -r 単独（末尾スペースを意図的に含める例）
      "Bash(rm -R )",           // -R 単独
      "Bash(rm -f /)",          // 絶対パス直下
      "Bash(rm -f //)",         // // 特殊
      "Bash(rm -f ..)",         // 親ディレクトリ参照
      "Bash(rm -f ../)",        // 親ディレクトリ配下
      "Bash(rm -f ~)",          // ホーム配下
      "Bash(rm -f * )",         // ワイルドカード（ゆるめのガード）
      "Bash(rm -f */)",          // ディレクトリワイルドカード
      "Bash(npm run dev)",
      "Bash(npm run preview)",
      "Bash(npm run build:watch)",
    ],
  };

  // Add session-related options if sessionId exists
  if (sessionId) {
    (options as any).resume = sessionId;
    console.log(`🔗 Using session ID for continuity: ${sessionId}`);
  }

  return options;
}

// Function to execute npm run build
export async function executeBuild(): Promise<void> {
  try {
    console.log("🔨 Starting npm run build in /app/react-app...");
    const { stdout, stderr } = await execAsync("npm run build", {
      cwd: "/app/react-app",
      timeout: 300000, // 5 minutes timeout
    });

    if (stdout) {
      console.log("📦 Build output:");
      console.log(stdout);
    }

    if (stderr) {
      console.log("⚠️ Build warnings/errors:");
      console.log(stderr);
    }

    console.log("✅ Build completed successfully");
  } catch (buildError: any) {
    console.error("❌ Build failed:");
    console.error(buildError);

    // Prepare build error details for retry
    const buildOutput = {
      stdout: buildError.stdout || "",
      stderr: buildError.stderr || buildError.message || "",
    };

    const error = new BuildError("Build failed", buildOutput);
    throw error;
  }
}

// Function to execute Claude Code session
export async function executeClaudeCode(
  prompt: string,
  queryOptions: Options,
  developmentRecord: DevelopmentRecord
): Promise<string | undefined> {
  let sessionId: string | undefined;

  try {
    console.log("🔍 Debug - Query options:");
    console.log(`  Model: ${queryOptions.model}`);
    console.log(`  MaxTurns: ${queryOptions.maxTurns}`);
    console.log(`  CWD: ${queryOptions.cwd}`);
    console.log(`  PermissionMode: ${queryOptions.permissionMode}`);
    console.log("🔍 Debug - Full options object:");
    // console.log(JSON.stringify(queryOptions, null, 2));
    console.log("🔍 Debug - Starting query execution...");
    console.log(
      `🔍 Debug - Prompt: "${prompt.substring(0, 100)}${
        prompt.length > 100 ? "..." : ""
      }"`
    );

    const queryIterator = query({
      prompt: prompt,
      options: queryOptions,
    });

    console.log("🔍 Debug - Query iterator created, starting message loop...");

    for await (const message of queryIterator) {
      console.log(
        `🔍 Debug - Received message type: ${message.type}, subtype: ${
          (message as any).subtype || "N/A"
        }`
      );
      sessionId = message.session_id;
      formatMessage(message);

      // Save message to database
      if (developmentRecord) {
        try {
          await saveMessageToDatabase(
            message,
            developmentRecord.id,
            queryOptions.model,
            developmentRecord.user_id
          );
          console.log("✅ Debug - Message saved to database successfully");
        } catch (dbError: any) {
          console.error(
            "❌ Debug - Failed to save message to database:",
            dbError
          );

          // Handle credit insufficient error specifically
          if (dbError.name === "InsufficientCreditError") {
            console.error(`💳 Credit insufficient: ${dbError.message}`);
            console.error(`💰 Current balance: $${dbError.currentBalance}`);
            console.error(`💸 Required cost: $${dbError.requiredCost}`);

            // Update development status to ERROR
            try {
              await updateDevelopmentStatusToError(
                developmentRecord,
                `Credit insufficient. Current: $${dbError.currentBalance}, Required: $${dbError.requiredCost}`,
                sessionId
              );
              console.log(
                "📝 Development status updated to ERROR due to insufficient credit"
              );
            } catch (updateError) {
              console.error(
                "❌ Failed to update development status to ERROR:",
                updateError
              );
            }

            // Re-throw the error to stop processing
            throw dbError;
          }

          // For other database errors, continue processing but log the error
          console.error(
            "⚠️ Continuing processing despite database save failure"
          );
        }
      }
    }

    console.log("🔍 Debug - Query execution completed");
    return sessionId;
  } catch (queryError) {
    console.log("🔍 Debug - Query error details:");
    console.log(
      `  Error name: ${
        queryError instanceof Error ? queryError.name : "Unknown"
      }`
    );
    console.log(
      `  Error message: ${
        queryError instanceof Error ? queryError.message : String(queryError)
      }`
    );

    throw queryError;
  }
}

// Function to execute a complete development cycle (Claude Code + Build + DB Update)
export async function executeDevelopmentCycle(
  prompt: string,
  sessionId: string | undefined,
  developmentRecord: DevelopmentRecord,
  options?: { model?: string }
): Promise<{
  success: boolean;
  sessionId?: string;
  buildErrorPrompt?: string;
}> {
  try {
    // Create query options
    const queryOptions = createQueryOptions(sessionId, options?.model);

    // Execute Claude Code session
    const newSessionId = await executeClaudeCode(
      prompt,
      queryOptions,
      developmentRecord
    );

    // Execute build
    await executeBuild();

    // Update development status to completed after successful build
    // Note: MiniAppVersion creation is now handled in updateDevelopmentStatusToCompleted
    await updateDevelopmentStatusToCompleted(developmentRecord, newSessionId);

    return { success: true, sessionId: newSessionId };
  } catch (error: any) {
    if (error.name === "BuildError") {
      // Generate error prompt for build failure retry
      const buildErrorPrompt = `Previous build failed with the following error. Please fix the build issues and ensure the code compiles successfully:

Build Error Details:
${error.buildOutput?.stderr}

${
  error.buildOutput?.stdout
    ? `Build Output:
${error.buildOutput.stdout}`
    : ""
}`;

      return {
        success: false,
        sessionId: sessionId,
        buildErrorPrompt,
      };
    }

    // Re-throw other errors
    throw error;
  }
}
