/**
 * Logging system with configurable log levels
 *
 * Environment variables:
 * - LOG_LEVEL: 0 (ERROR), 1 (NORMAL), 2 (DEBUG)
 * - SHOW_PROMPT: true/false - Show full prompt text
 * - SHOW_TOOL_INPUT: true/false - Show detailed tool input JSON
 */

export enum LogLevel {
  ERROR = 0, // Errors only (production)
  NORMAL = 1, // Important events + errors (default)
  DEBUG = 2, // Everything (development)
}

const LOG_LEVEL = parseInt(process.env.LOG_LEVEL || '1', 10)
const SHOW_PROMPT = process.env.SHOW_PROMPT === 'true'
const SHOW_TOOL_INPUT = process.env.SHOW_TOOL_INPUT === 'true'

export const config = {
  level: LOG_LEVEL,
  showPrompt: SHOW_PROMPT,
  showToolInput: SHOW_TOOL_INPUT,
}

/**
 * Logger instance with level-based filtering
 */
export const logger = {
  /**
   * Always shown - Errors and critical issues
   */
  error: (emoji: string, message: string, details?: any) => {
    console.error(`${emoji} ${message}`)
    if (details !== undefined) {
      console.error(details)
    }
  },

  /**
   * Shown at NORMAL and DEBUG levels - Important events
   */
  info: (emoji: string, message: string, details?: any) => {
    if (LOG_LEVEL >= LogLevel.NORMAL) {
      console.log(`${emoji} ${message}`)
      if (details !== undefined && LOG_LEVEL >= LogLevel.DEBUG) {
        console.log(details)
      }
    }
  },

  /**
   * Shown at DEBUG level only - Verbose logging
   */
  debug: (emoji: string, message: string, details?: any) => {
    if (LOG_LEVEL >= LogLevel.DEBUG) {
      console.log(`${emoji} ${message}`)
      if (details !== undefined) {
        console.log(details)
      }
    }
  },
}

/**
 * Format error with emphasis
 */
export function formatError(
  context: string,
  error: any,
  eventData?: any
): void {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.error(`❌ ERROR: ${context}`)
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.error(`Type: ${error.name || 'Unknown'}`)
  console.error(`Message: ${error.message || String(error)}`)

  if (eventData) {
    console.error('\n📋 Event Data:')
    console.error(JSON.stringify(eventData, null, 2))
  }

  if (error.stack && LOG_LEVEL >= LogLevel.DEBUG) {
    console.error('\n📚 Stack Trace:')
    console.error(error.stack)
  }
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

/**
 * Truncate text for display
 */
export function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
