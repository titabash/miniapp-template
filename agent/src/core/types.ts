// Custom error class for build failures
export class BuildError extends Error {
  constructor(
    message: string,
    public buildOutput?: { stdout?: string; stderr?: string }
  ) {
    super(message);
    this.name = "BuildError";
  }
}

// Type definitions for development record
export interface DevelopmentRecord {
  id: string;
  miniapp_id: string;
  user_id: string;
  user_instruction: string;
  status: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
  finished_at?: string;
}

// Import types from @anthropic-ai/claude-code
export type {
  SDKMessage as Message,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  Options,
} from "@anthropic-ai/claude-code";
