import { Command } from "commander";
import {
  createDevelopmentRecord,
  updateDevelopmentStatusToError,
  getPreviousSessionId,
} from "./core/database.ts";
import { createAgent, getAvailableAgents } from "./core/agent-factory.ts";

const program = new Command();

program
  .name("agent")
  .description("Multi-agent system for miniapp development")
  .version("1.0.0")
  .argument("<userPrompt>", "user prompt for the development task")
  .argument("<aiPrompt>", "AI prompt for the development task")
  .argument("<userId>", "user ID")
  .argument("<miniAppId>", "miniapp ID")
  .option("-r, --resume", "resume from previous session", false)
  .option(
    "-a, --agent <type>",
    "specify agent type (claude-code)",
    "claude-code"
  )
  .option("-m, --model <name>", "specify model name (optional)")
  .parse();

const [userPrompt, aiPrompt, userId, miniAppId] = program.args;
const options = program.opts();
const shouldResume = options.resume;
const agentType = options.agent;
const modelName = options.model;

// Validate agent type
if (!getAvailableAgents().includes(agentType)) {
  console.error(`❌ Unknown agent type: ${agentType}`);
  console.error(`Available agents: ${getAvailableAgents().join(", ")}`);
  process.exit(1);
}

// デバッグ: 引数の内容を確認
console.log("🔍 Debug - Arguments:");
console.log(`  userPrompt (argv[2]): "${userPrompt}"`);
console.log(`  aiPrompt (argv[3]): "${aiPrompt}"`);
console.log(`  userId (argv[4]): "${userId}"`);
console.log(`  miniAppId (argv[5]): "${miniAppId}"`);
console.log(`  --resume flag: ${shouldResume}`);
console.log(`  --agent: ${agentType}`);
console.log(`  --model: ${modelName || "default"}`);
console.log("=".repeat(80));

(async () => {
  let developmentRecord: any = null;
  let sessionId: string | undefined | null = undefined;

  console.log(`🚀 Starting ${agentType} agent session`);
  console.log(`👤 User prompt: "${userPrompt}"`);
  console.log(`🤖 AI prompt: "${aiPrompt}"`);
  console.log("=".repeat(80));

  // Session ID setup (moved outside retry loop)
  try {
    // Get the latest session_id for context continuity (only if --resume flag is present)
    if (shouldResume) {
      sessionId = await getPreviousSessionId(miniAppId);
      if (sessionId) {
        console.log(`🔗 Using previous session ID for context: ${sessionId}`);
      } else {
        console.log("🆕 No previous session found, starting new session");
      }
    } else {
      console.log("🆕 Starting new session (--resume flag not provided)");
    }
  } catch (sessionError) {
    console.log(
      "⚠️ Session ID setup failed, starting new session:",
      sessionError
    );
  }

  // Retry loop with independent error handling
  const maxRetries = 3;
  let attempt = 0;
  let currentAiPrompt = aiPrompt; // Track the current AI prompt for build error retries

  console.log(`🔄 Entering retry loop (maxRetries: ${maxRetries})`);

  try {
    while (attempt < maxRetries) {
      attempt++;
      console.log(`\n🚀 Starting attempt ${attempt}/${maxRetries}`);

      try {
        // Create new development record for this execution
        if (!developmentRecord) {
          developmentRecord = await createDevelopmentRecord(
            miniAppId,
            userId,
            userPrompt
          );
          console.log(`📝 Development record created: ${developmentRecord.id}`);
        }

        // Create agent instance
        const agent = await createAgent(agentType);

        // Execute development cycle (Agent + Build + DB Update)
        const result = await agent.executeDevelopmentCycle(
          currentAiPrompt,
          sessionId ?? undefined,
          developmentRecord,
          { model: modelName }
        );

        if (result.success) {
          // Update session ID for future attempts
          sessionId = result.sessionId;
          break; // Success, exit retry loop
        } else {
          // Build error occurred, update prompt for retry
          currentAiPrompt = result.buildErrorPrompt!;
          sessionId = result.sessionId;

          // Treat as an error to trigger retry logic
          const buildError = new Error("Build failed");
          buildError.name = "BuildError";
          throw buildError;
        }
      } catch (error) {
        const isLastAttempt = attempt >= maxRetries;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.log(`\n❌ Error occurred (Attempt ${attempt}/${maxRetries}):`);
        console.log(error);
        console.log(
          `🔍 Debug - isLastAttempt: ${isLastAttempt} (attempt: ${attempt}, maxRetries: ${maxRetries})`
        );

        if (isLastAttempt) {
          // Update development status to error only on the final failed attempt
          try {
            await updateDevelopmentStatusToError(
              developmentRecord,
              errorMessage,
              sessionId ?? undefined
            );
          } catch (dbError) {
            console.error(
              "⚠️ Failed to update development status to error:",
              dbError
            );
            // Continue with the original error handling
          }
          console.log("\n💀 All retry attempts failed. Exiting...");
          throw error;
        }

        // Handle build errors specifically
        if (error instanceof Error && error.name === "BuildError") {
          console.log("🔄 Retrying due to build error with updated prompt");
          console.log(
            `🔄 Updated prompt: ${currentAiPrompt.substring(0, 200)}...`
          );
        } else {
          // Reset AI prompt for non-build errors
          currentAiPrompt = aiPrompt;
        }

        // 指数バックオフでリトライ間隔を設定 (1秒, 2秒, 4秒)
        const retryDelay = Math.pow(2, attempt - 1) * 1000;
        console.log(`\n🔄 Retrying in ${retryDelay / 1000} seconds...`);
        console.log(`🔄 Next attempt will be ${attempt + 1}/${maxRetries}`);
        console.log(`🔄 About to wait ${retryDelay}ms before retry...`);

        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        console.log(`🔄 Wait completed, continuing to next iteration...`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`🏁 ${agentType} agent session completed`);
  } catch (fatalError) {
    const errorMessage =
      fatalError instanceof Error ? fatalError.message : String(fatalError);
    console.error(`\n💀 Fatal error in ${agentType} agent session:`);
    console.error(fatalError);

    // Ensure error status is updated for fatal errors (developmentRecord may be null)
    if (developmentRecord) {
      try {
        await updateDevelopmentStatusToError(developmentRecord, errorMessage);
      } catch (dbError) {
        console.error(
          "⚠️ Failed to update development status in fatal error handler:",
          dbError
        );
      }
    } else {
      console.error("⚠️ developmentRecord is null, cannot update status");
    }

    process.exit(1);
  }
})().catch(async (error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("🚨 Unhandled error in main function:");
  console.error(error);

  // This shouldn't have access to developmentRecord due to scope,
  // but we'll log the attempt for debugging
  console.error("⚠️ Cannot update development status - record not in scope");

  process.exit(1);
});
