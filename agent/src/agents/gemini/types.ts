// Claude Code SDK互換の型定義

// Anthropic SDK互換のメッセージ型
export type APIUserMessage = {
  role: 'user'
  content: string | Array<any>
}

export type APIAssistantMessage = {
  role: 'assistant'
  content: string | Array<any>
}

export type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export type NonNullableUsage = {
  [K in keyof Usage]: NonNullable<Usage[K]>
}

export type ApiKeySource = 'user' | 'project' | 'org' | 'temporary'

export type ConfigScope = 'local' | 'user' | 'project'

export type PermissionResult =
  | {
      behavior: 'allow'
      updatedInput: Record<string, unknown>
    }
  | {
      behavior: 'deny'
      message: string
    }

export type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<PermissionResult>

// MCP Server設定（Claude Code SDK互換）
export type McpStdioServerConfig = {
  type?: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
}

export type McpSSEServerConfig = {
  type: 'sse'
  url: string
  headers?: Record<string, string>
}

export type McpHttpServerConfig = {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

export type McpServerConfig =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig

export type Options = {
  // Claude Code SDK互換オプション
  abortController?: AbortController
  allowedTools?: string[]
  appendSystemPrompt?: string
  customSystemPrompt?: string
  cwd?: string
  disallowedTools?: string[]
  maxTurns?: number
  mcpServers?: Record<string, McpServerConfig>
  permissionMode?: PermissionMode
  model?: string
  fallbackModel?: string
  stderr?: (data: string) => void
  canUseTool?: CanUseTool
  continue?: boolean
  resume?: string
  
  // Gemini CLI固有オプション
  sandbox?: boolean
  debug?: boolean
  yolo?: boolean
  allFiles?: boolean
  showMemoryUsage?: boolean
  checkpointing?: boolean
  pathToGeminiExecutable?: string
  env?: Record<string, string>
}

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'

export type SDKUserMessage = {
  type: 'user'
  message: APIUserMessage
  parent_tool_use_id: string | null
  session_id: string
}

export type SDKAssistantMessage = {
  type: 'assistant'
  message: APIAssistantMessage
  parent_tool_use_id: string | null
  session_id: string
}

export type SDKResultMessage =
  | {
      type: 'result'
      subtype: 'success'
      duration_ms: number
      duration_api_ms: number
      is_error: boolean
      num_turns: number
      result: string
      session_id: string
      total_cost_usd: number
      usage: NonNullableUsage
    }
  | {
      type: 'result'
      subtype: 'error_max_turns' | 'error_during_execution'
      duration_ms: number
      duration_api_ms: number
      is_error: boolean
      num_turns: number
      session_id: string
      total_cost_usd: number
      usage: NonNullableUsage
    }

export type SDKSystemMessage = {
  type: 'system'
  subtype: 'init'
  apiKeySource: ApiKeySource
  cwd: string
  session_id: string
  tools: string[]
  mcp_servers: {
    name: string
    status: string
  }[]
  model: string
  permissionMode: PermissionMode
  slash_commands: string[]
}

export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKResultMessage
  | SDKSystemMessage

export type Props = {
  prompt: string | AsyncIterable<SDKUserMessage>
  options?: Options
}

export interface Query extends AsyncGenerator<SDKMessage, void> {
  /**
   * Interrupt the query.
   * Only supported when streaming input is used.
   */
  interrupt(): Promise<void>
}

export class AbortError extends Error {}