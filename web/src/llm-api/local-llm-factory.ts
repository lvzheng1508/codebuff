import { getCurrentConfig } from '@/app/api/v1/config/route'
import type { LocalEndpoint, AgentModelBinding } from '@codebuff/common/config/local-config.types'

export interface LlmClientConfig {
  baseUrl: string
  apiKey?: string
  model: string
}

function getEnv() {
  // Lazy load env to avoid validation during test setup
  return require('@codebuff/internal/env').env
}

export function getLlmClientForAgent(agentId: string, defaultModel: string): LlmClientConfig {
  const config = getCurrentConfig()

  if (!config || config.mode !== 'local') {
    // Use default behavior (env vars, existing logic)
    console.warn(`No local config found or not in local mode, using environment variables`)
    const env = getEnv()
    return {
      baseUrl: env.OPENAI_API_BASE || 'https://api.openai.com',
      apiKey: env.OPENAI_API_KEY,
      model: defaultModel,
    }
  }

  // Find agent-specific binding
  const binding = config.agent_bindings?.find(b => b.agent_id === agentId)
  const endpointName = binding?.endpoint || config.default_endpoint

  if (!endpointName) {
    throw new Error(
      `No endpoint configured for agent "${agentId}". ` +
      `Either set "default_endpoint" in codebuff.local config ` +
      `or add an agent_binding for this agent.`
    )
  }

  const endpoint = config.endpoints.find(e => e.name === endpointName)
  if (!endpoint) {
    const availableEndpoints = config.endpoints.map(e => e.name).join(', ')
    throw new Error(
      `Endpoint "${endpointName}" not found in config. ` +
      `Available endpoints: ${availableEndpoints}. ` +
      `Check your agent_binding or default_endpoint configuration.`
    )
  }

  const env = getEnv()
  return {
    baseUrl: endpoint.base_url,
    apiKey: endpoint.api_key || env.OPENAI_API_KEY,
    model: binding?.model || endpoint.model || defaultModel,
  }
}
