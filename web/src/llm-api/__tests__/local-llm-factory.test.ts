import { describe, expect, test, mock } from 'bun:test'

// Set up minimal environment before importing any modules
process.env.NEXT_PUBLIC_CB_ENVIRONMENT = 'test'
process.env.NEXT_PUBLIC_CODEBUFF_APP_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'test@example.com'
process.env.NEXT_PUBLIC_POSTHOG_API_KEY = 'test-key'
process.env.NEXT_PUBLIC_POSTHOG_HOST_URL = 'https://example.com'
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test'
process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL = 'https://example.com'
process.env.NEXT_PUBLIC_WEB_PORT = '3000'
process.env.OPENAI_API_KEY = 'test-key'
process.env.ANTHROPIC_API_KEY = 'test-key'
process.env.GRAVITY_API_KEY = 'test-key'
process.env.STRIPE_SUBSCRIPTION_100_PRICE_ID = 'price_test_100'
process.env.STRIPE_SUBSCRIPTION_200_PRICE_ID = 'price_test_200'
process.env.STRIPE_SUBSCRIPTION_500_PRICE_ID = 'price_test_500'

describe('getLlmClientForAgent', () => {
  test('uses default behavior when no config', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => null,
      POST: () => {},
      GET: () => {},
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')
    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.baseUrl).toBe('https://api.openai.com')
    expect(result.model).toBe('gpt-4')
    expect(result.apiKey).toBe('test-key')
  })

  test('uses agent-specific binding when configured', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => ({
        mode: 'local',
        endpoints: [
          { name: 'custom', base_url: 'https://custom.ai', api_key: 'custom-key' },
        ],
        agent_bindings: [
          { agent_id: 'test-agent', endpoint: 'custom' },
        ],
        default_endpoint: undefined,
      }),
      POST: () => {},
      GET: () => {},
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')
    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.baseUrl).toBe('https://custom.ai')
    expect(result.apiKey).toBe('custom-key')
    expect(result.model).toBe('gpt-4')
  })

  test('uses default endpoint when no agent-specific binding exists', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => ({
        mode: 'local',
        endpoints: [
          { name: 'default-ep', base_url: 'https://default.ai', api_key: 'default-key' },
        ],
        agent_bindings: [],
        default_endpoint: 'default-ep',
      }),
      POST: () => {},
      GET: () => {},
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')
    const result = getLlmClientForAgent('unbound-agent', 'gpt-4')

    expect(result.baseUrl).toBe('https://default.ai')
    expect(result.apiKey).toBe('default-key')
    expect(result.model).toBe('gpt-4')
  })

  test('throws error when no endpoint configured for agent', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => ({
        mode: 'local',
        endpoints: [
          { name: 'custom', base_url: 'https://custom.ai', api_key: 'test-key' },
        ],
        agent_bindings: [],
        default_endpoint: undefined,
      }),
      POST: () => {},
      GET: () => {},
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')

    expect(() => getLlmClientForAgent('test-agent', 'gpt-4')).toThrow(
      'No endpoint configured for agent test-agent'
    )
  })

  test('throws error when endpoint not found in config', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => ({
        mode: 'local',
        endpoints: [],
        agent_bindings: [
          { agent_id: 'test-agent', endpoint: 'nonexistent' },
        ],
        default_endpoint: undefined,
      }),
      POST: () => {},
      GET: () => {},
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')

    expect(() => getLlmClientForAgent('test-agent', 'gpt-4')).toThrow(
      'Endpoint nonexistent not found in config'
    )
  })

  test('uses binding model when specified', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => ({
        mode: 'local',
        endpoints: [
          { name: 'custom', base_url: 'https://custom.ai', api_key: 'test-key' },
        ],
        agent_bindings: [
          { agent_id: 'test-agent', endpoint: 'custom', model: 'custom-model' },
        ],
        default_endpoint: undefined,
      }),
      POST: () => {},
      GET: () => {},
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')
    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.model).toBe('custom-model')
  })

  test('falls back to endpoint model when binding model not specified', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => ({
        mode: 'local',
        endpoints: [
          { name: 'custom', base_url: 'https://custom.ai', api_key: 'test-key', model: 'endpoint-model' },
        ],
        agent_bindings: [
          { agent_id: 'test-agent', endpoint: 'custom' },
        ],
        default_endpoint: undefined,
      }),
      POST: () => {},
      GET: () => {},
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')
    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.model).toBe('endpoint-model')
  })

  test('falls back to default model when neither binding nor endpoint specifies model', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => ({
        mode: 'local',
        endpoints: [
          { name: 'custom', base_url: 'https://custom.ai', api_key: 'test-key' },
        ],
        agent_bindings: [
          { agent_id: 'test-agent', endpoint: 'custom' },
        ],
        default_endpoint: undefined,
      }),
      POST: () => {},
      GET: () => {},
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')
    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.model).toBe('gpt-4')
  })

  test('falls back to env API key when endpoint does not specify api_key', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => ({
        mode: 'local',
        endpoints: [
          { name: 'custom', base_url: 'https://custom.ai' },
        ],
        agent_bindings: [
          { agent_id: 'test-agent', endpoint: 'custom' },
        ],
        default_endpoint: undefined,
      }),
      POST: () => {},
      GET: () => {},
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')
    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.baseUrl).toBe('https://custom.ai')
    expect(result.apiKey).toBe('test-key') // Falls back to env var
  })

  test('respects OPENAI_API_BASE env var in default mode', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => null,
      POST: () => {},
      GET: () => {},
    }))

    mock.module('@codebuff/internal/env', () => ({
      env: {
        OPENAI_API_BASE: 'https://custom-base.example.com',
        OPENAI_API_KEY: 'test-key',
      },
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')
    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.baseUrl).toBe('https://custom-base.example.com')
  })

  test('handles cloud mode (not local)', () => {
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: () => ({
        mode: 'cloud',
        endpoints: [],
        agent_bindings: [],
      }),
      POST: () => {},
      GET: () => {},
    }))

    // Reset env mock to default values
    mock.module('@codebuff/internal/env', () => ({
      env: {
        OPENAI_API_KEY: 'test-key',
        OPENAI_API_BASE: undefined,
      },
    }))

    const { getLlmClientForAgent } = require('../local-llm-factory')
    const result = getLlmClientForAgent('test-agent', 'gpt-4')

    expect(result.baseUrl).toBe('https://api.openai.com')
    expect(result.apiKey).toBe('test-key')
  })
})
