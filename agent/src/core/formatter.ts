import type {
  Message,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
} from './types'
import { logger, LogLevel, config, truncate } from './logger'

// Type guard functions
function isUserMessage(message: Message): message is SDKUserMessage {
  return message.type === 'user'
}

function isAssistantMessage(message: Message): message is SDKAssistantMessage {
  return message.type === 'assistant'
}

function isResultMessage(message: Message): message is SDKResultMessage {
  return message.type === 'result'
}

function isSystemMessage(message: Message): message is SDKSystemMessage {
  return message.type === 'system'
}

export function formatMessage(message: Message) {
  const timestamp = new Date().toISOString()

  if (isSystemMessage(message)) {
    // NORMAL: Show simplified session start info
    logger.info(
      '🔧',
      `SESSION STARTED - ${message.model} (${message.permissionMode})`
    )
    logger.debug('🔧', `Session ID: ${message.session_id}`)
    logger.debug('🔧', `CWD: ${message.cwd}`)
    logger.debug('🔧', `API Key: ${message.apiKeySource}`)
    if (config.level >= LogLevel.DEBUG && message.mcp_servers?.length) {
      logger.debug('🔧', `MCP Servers: ${message.mcp_servers.map((s) => `${s.name}(${s.status})`).join(', ')}`)
    }
  } else if (isUserMessage(message)) {
    // DEBUG: Show user messages (usually prompts)
    if (config.showPrompt) {
      logger.debug('👤', `USER MESSAGE`)
      logger.debug('👤', `Content: ${JSON.stringify(message.message?.content, null, 2)}`)
    } else {
      const contentPreview =
        typeof message.message?.content === 'string'
          ? truncate(message.message.content)
          : '[Complex content]'
      logger.debug('👤', `USER: ${contentPreview}`)
    }
  } else if (isAssistantMessage(message)) {
    // NORMAL: Show assistant messages (text and important tool uses)
    if (message.message?.content) {
      message.message.content.forEach((content: any) => {
        if (content.type === 'text') {
          // Always show assistant text at NORMAL level
          logger.info('🤖', `${truncate(content.text, 200)}`)
        } else if (content.type === 'tool_use') {
          // Show tool use at NORMAL level (important actions)
          logger.info('🔧', `Tool: ${content.name}`)

          // Show tool input details only in DEBUG or if SHOW_TOOL_INPUT is true
          if (config.showToolInput || config.level >= LogLevel.DEBUG) {
            logger.debug('🔧', `  Input: ${JSON.stringify(content.input, null, 2)}`)
          } else {
            // Show simplified input for common tools
            const inputSummary = getToolInputSummary(content.name, content.input)
            if (inputSummary) {
              logger.info('🔧', `  ${inputSummary}`)
            }
          }
        }
      })
    }

    // Show usage at DEBUG level
    if (message.message?.usage && config.level >= LogLevel.DEBUG) {
      const usage = message.message.usage
      const cached = usage.cache_read_input_tokens || 0
      logger.debug(
        '📊',
        `Tokens: ${usage.input_tokens || 0} in (${cached} cached) / ${usage.output_tokens || 0} out`
      )
    }
  } else if (isResultMessage(message)) {
    // ERROR: Show error results with emphasis
    // NORMAL: Show success results with summary
    const isError = message.subtype !== 'success'

    if (isError) {
      logger.error('❌', `SESSION ENDED: ${message.subtype}`)
      logger.error('❌', `Turns: ${message.num_turns} | Duration: ${(message.duration_ms / 1000).toFixed(1)}s`)
    } else {
      logger.info('✅', `SESSION COMPLETED`)
      logger.info(
        '📊',
        `Duration: ${(message.duration_ms / 1000).toFixed(1)}s | Turns: ${message.num_turns} | Cost: $${message.total_cost_usd?.toFixed(4)}`
      )
    }

    if (message.usage && config.level >= LogLevel.NORMAL) {
      const usage = message.usage
      const cached = usage.cache_read_input_tokens || 0
      const total = (usage.input_tokens || 0) + (usage.output_tokens || 0)
      logger.info(
        '📊',
        `Tokens: ${usage.input_tokens || 0} in (${cached} cached) / ${usage.output_tokens || 0} out = ${total} total`
      )
    }

    if (message.subtype === 'success' && 'result' in message) {
      logger.debug('📝', `Result: ${message.result}`)
    }
  } else {
    // Unknown message type - always log at ERROR level
    logger.error('❓', `UNKNOWN MESSAGE TYPE`)
    logger.error('❓', JSON.stringify(message, null, 2))
  }
}

/**
 * Get simplified summary of tool input for common tools
 */
function getToolInputSummary(toolName: string, input: any): string | null {
  switch (toolName) {
    case 'Write':
      return `Path: ${input.file_path}`
    case 'Edit':
    case 'MultiEdit':
      return `Path: ${input.file_path}`
    case 'Read':
      return `Path: ${input.file_path}`
    case 'Bash':
      return `Command: ${truncate(input.command, 80)}`
    case 'Glob':
      return `Pattern: ${input.pattern}`
    case 'Grep':
      return `Pattern: ${input.pattern}`
    default:
      return null
  }
}
