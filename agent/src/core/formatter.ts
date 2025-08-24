import type {
  Message,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
} from "./types.ts";

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

export function formatMessage(message: Message) {
  const timestamp = new Date().toISOString();

  if (isSystemMessage(message)) {
    console.log(`\n🔧 [${timestamp}] SYSTEM (${message.subtype})`);
    console.log(`   Session ID: ${message.session_id}`);
    console.log(`   API Key Source: ${message.apiKeySource}`);
    console.log(`   Model: ${message.model}`);
    console.log(`   Permission Mode: ${message.permissionMode}`);
    console.log(`   Working Directory: ${message.cwd}`);
    console.log(`   Available Tools: ${message.tools?.join(", ")}`);
    if (message.mcp_servers?.length && message.mcp_servers.length > 0) {
      console.log(`   MCP Servers:`);
      message.mcp_servers.forEach((server) => {
        console.log(`     - ${server.name}: ${server.status}`);
      });
    }
  } else if (isUserMessage(message)) {
    console.log(`\n👤 [${timestamp}] USER`);
    console.log(`   Session ID: ${message.session_id}`);
    if (message.parent_tool_use_id) {
      console.log(`   Parent Tool Use ID: ${message.parent_tool_use_id}`);
    }
    console.log(
      `   Content: ${JSON.stringify(message.message?.content, null, 2)}`
    );
  } else if (isAssistantMessage(message)) {
    console.log(`\n🤖 [${timestamp}] ASSISTANT`);
    console.log(`   Session ID: ${message.session_id}`);
    if (message.parent_tool_use_id) {
      console.log(`   Parent Tool Use ID: ${message.parent_tool_use_id}`);
    }

    if (message.message?.content) {
      message.message.content.forEach((content: any, index: number) => {
        if (content.type === "text") {
          console.log(`   Text [${index}]: ${content.text}`);
        } else if (content.type === "tool_use") {
          console.log(`   Tool Use [${index}]: ${content.name}`);
          console.log(`     ID: ${content.id}`);
          console.log(`     Input: ${JSON.stringify(content.input, null, 6)}`);
        }
      });
    }

    if (message.message?.usage) {
      console.log(`   Usage:`);
      console.log(
        `     Input Tokens: ${message.message.usage.input_tokens || 0}`
      );
      console.log(
        `     Output Tokens: ${message.message.usage.output_tokens || 0}`
      );
      if (message.message.usage.cache_creation_input_tokens) {
        console.log(
          `     Cache Creation Tokens: ${message.message.usage.cache_creation_input_tokens}`
        );
      }
      if (message.message.usage.cache_read_input_tokens) {
        console.log(
          `     Cache Read Tokens: ${message.message.usage.cache_read_input_tokens}`
        );
      }
      const totalTokens =
        (message.message.usage.input_tokens || 0) +
        (message.message.usage.output_tokens || 0);
      console.log(`     Total Tokens: ${totalTokens}`);
    }
  } else if (isResultMessage(message)) {
    console.log(`\n✅ [${timestamp}] RESULT (${message.subtype})`);
    console.log(`   Session ID: ${message.session_id}`);
    console.log(
      `   Duration: ${message.duration_ms}ms (API: ${message.duration_api_ms}ms)`
    );
    console.log(`   Turns: ${message.num_turns}`);
    console.log(`   Cost: $${message.total_cost_usd?.toFixed(4)}`);
    console.log(`   Is Error: ${message.is_error}`);

    if (message.usage) {
      console.log(`   Total Usage:`);
      console.log(`     Input Tokens: ${message.usage.input_tokens || 0}`);
      console.log(`     Output Tokens: ${message.usage.output_tokens || 0}`);
      if (message.usage.cache_creation_input_tokens) {
        console.log(
          `     Cache Creation Tokens: ${message.usage.cache_creation_input_tokens}`
        );
      }
      if (message.usage.cache_read_input_tokens) {
        console.log(
          `     Cache Read Tokens: ${message.usage.cache_read_input_tokens}`
        );
      }
      const totalTokens =
        (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0);
      console.log(`     Total Tokens: ${totalTokens}`);
    }

    if (message.subtype === "success" && "result" in message) {
      console.log(`   Result: ${message.result}`);
    }
  } else {
    console.log(`\n❓ [${timestamp}] UNKNOWN MESSAGE TYPE`);
    console.log(JSON.stringify(message, null, 2));
  }
}
