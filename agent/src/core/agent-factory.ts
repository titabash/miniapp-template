import type { DevelopmentRecord } from './types'

// Agent configuration options
export interface AgentOptions {
  model?: string
}

// Base interface for all agents
export interface Agent {
  executeDevelopmentCycle(
    prompt: string,
    sessionId: string | undefined,
    developmentRecord: DevelopmentRecord,
    options?: AgentOptions
  ): Promise<{
    success: boolean
    sessionId?: string
    buildErrorPrompt?: string
  }>
}

// Agent factory function
export async function createAgent(agentType: string): Promise<Agent> {
  switch (agentType) {
    case 'claude-code': {
      const claudeCodeModule = await import('../agents/claude-code/executor')
      return {
        executeDevelopmentCycle: claudeCodeModule.executeDevelopmentCycle,
      }
    }
    default:
      throw new Error(
        `Unknown agent type: ${agentType}. Available agents: claude-code`
      )
  }
}

// Get available agent types
export function getAvailableAgents(): string[] {
  return ['claude-code']
}
