import { ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import type {
  SDKMessage,
  SDKSystemMessage,
  SDKResultMessage,
  SDKAssistantMessage,
  Query as QueryInterface,
} from './types.js'
import { Stream } from './stream.js'

export class GeminiQuery implements QueryInterface {
  private childProcess: ChildProcess
  private processExitPromise: Promise<void>
  private sdkMessages: AsyncGenerator<SDKMessage, void>
  private inputStream = new Stream<SDKMessage>()
  private sessionId = Math.random().toString(36).substring(2, 15)
  private startTime = Date.now()
  private numTurns = 0

  async [Symbol.asyncDispose](): Promise<void> {
    await this.return()
  }

  constructor(childProcess: ChildProcess, processExitPromise: Promise<void>) {
    this.childProcess = childProcess
    this.processExitPromise = processExitPromise
    this.readMessages()
    this.sdkMessages = this.readSdkMessages()
  }

  setError(error: any) {
    this.inputStream.error(error)
  }

  next(
    ...[value]: [] | [undefined]
  ): Promise<IteratorResult<SDKMessage, void>> {
    return this.sdkMessages.next(...[value])
  }

  return(value?: any): Promise<IteratorResult<SDKMessage, void>> {
    return this.sdkMessages.return(value)
  }

  throw(e?: any): Promise<IteratorResult<SDKMessage, void>> {
    return this.sdkMessages.throw(e)
  }

  [Symbol.asyncIterator]() {
    return this.sdkMessages
  }

  async interrupt(): Promise<void> {
    if (!this.childProcess.killed) {
      this.childProcess.kill('SIGTERM')
    }
  }

  private async readMessages() {
    if (!this.childProcess.stdout) {
      this.inputStream.error(new Error('No stdout available'))
      return
    }

    const rl = createInterface({ input: this.childProcess.stdout })
    let outputBuffer = ''
    let aiResponseBuffer = ''

    try {
      // 初期システムメッセージを送信
      this.sendSystemMessage()

      for await (const line of rl) {
        if (line.trim()) {
          outputBuffer += line + '\n'

          // 適切なフィルタリングでAI応答のみを抽出
          const cleanLine = line.trim()
          if (!this.isDebugOrMetaLine(cleanLine)) {
            if (cleanLine) {
              aiResponseBuffer += cleanLine + '\n'
              this.sendAssistantMessage(cleanLine)
            }
          }
          this.numTurns++
        }
      }

      await this.processExitPromise

      // 最終結果メッセージを送信（AIの応答部分のみ）
      this.sendResultMessage(
        aiResponseBuffer.trim() || outputBuffer.trim(),
        false
      )
    } catch (error) {
      this.sendResultMessage('', true)
      this.inputStream.error(error)
    } finally {
      this.inputStream.done()
      rl.close()
    }
  }

  private sendSystemMessage() {
    const systemMessage: SDKSystemMessage = {
      type: 'system',
      subtype: 'init',
      apiKeySource: 'user',
      cwd: process.cwd(),
      session_id: this.sessionId,
      tools: ['read-file', 'write-file', 'edit', 'shell', 'glob', 'grep'],
      mcp_servers: [],
      model: 'gemini-2.5-pro',
      permissionMode: 'default',
      slash_commands: [],
    }
    this.inputStream.enqueue(systemMessage)
  }

  private isDebugOrMetaLine(line: string): boolean {
    // 実際のAI応答以外をフィルタリング
    return (
      line.startsWith('[DEBUG]') ||
      line.startsWith('[dotenv@') ||
      line.includes('injecting env') ||
      line.startsWith('(node:') ||
      line.includes('DeprecationWarning') ||
      line.includes('Flushing log events') ||
      line.includes('Clearcut response') ||
      line.includes('[MemoryDiscovery]') ||
      line.includes('[BfsFileSearch]') ||
      line.includes('CLI: Delegating') ||
      line === ''
    )
  }

  private sendAssistantMessage(content: string) {
    const assistantMessage: SDKAssistantMessage = {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: content,
      },
      parent_tool_use_id: null,
      session_id: this.sessionId,
    }
    this.inputStream.enqueue(assistantMessage)
  }

  private sendResultMessage(result: string, isError: boolean) {
    const duration = Date.now() - this.startTime

    if (isError) {
      const errorMessage: SDKResultMessage = {
        type: 'result',
        subtype: 'error_during_execution',
        duration_ms: duration,
        duration_api_ms: duration,
        is_error: true,
        num_turns: this.numTurns,
        session_id: this.sessionId,
        total_cost_usd: 0,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
        },
      }
      this.inputStream.enqueue(errorMessage)
    } else {
      const successMessage: SDKResultMessage = {
        type: 'result',
        subtype: 'success',
        duration_ms: duration,
        duration_api_ms: duration,
        is_error: false,
        num_turns: this.numTurns,
        result,
        session_id: this.sessionId,
        total_cost_usd: 0,
        usage: {
          input_tokens: 0,
          output_tokens: result.length,
        },
      }
      this.inputStream.enqueue(successMessage)
    }
  }

  private async *readSdkMessages(): AsyncGenerator<SDKMessage, void> {
    for await (const message of this.inputStream) {
      yield message
    }
  }
}
