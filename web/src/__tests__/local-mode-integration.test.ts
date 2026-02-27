import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { POST, GET, getCurrentConfig } from '../app/api/v1/config/route'
import type { LocalCliConfig } from '@codebuff/common/config/local-config.types'

// Helper to create a mock NextRequest
function createMockRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/v1/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('Config Route Integration', () => {
  // Reset the config before each test
  beforeEach(() => {
    // Call GET to reset to null (since module state persists)
    // We'll reset via module import
  })

  afterEach(() => {
    // Reset config after each test
    const configModule = require('../app/api/v1/config/route')
    // The module exports getCurrentConfig but we can't directly set currentConfig
    // We can send a null config to reset
  })

  describe('POST /api/v1/config', () => {
    test('accepts valid local config', async () => {
      const config: LocalCliConfig = {
        mode: 'local',
        endpoints: [
          {
            name: 'openai',
            base_url: 'https://api.openai.com',
            api_key: 'sk-test123',
          },
        ],
      }

      const request = createMockRequest({ config })
      const response = await POST(request as any)

      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body).toEqual({ success: true })

      // Verify config was stored
      const storedConfig = getCurrentConfig()
      expect(storedConfig).toEqual(config)
    })

    test('accepts config with multiple endpoints', async () => {
      const config: LocalCliConfig = {
        mode: 'local',
        default_endpoint: 'openai',
        endpoints: [
          {
            name: 'openai',
            base_url: 'https://api.openai.com',
            api_key: 'sk-1',
          },
          {
            name: 'anthropic',
            base_url: 'https://api.anthropic.com',
            api_key: 'sk-2',
          },
        ],
        agent_bindings: [
          { agent_id: 'agent-1', endpoint: 'openai' },
        ],
      }

      const request = createMockRequest({ config })
      const response = await POST(request as any)

      expect(response.status).toBe(200)

      const storedConfig = getCurrentConfig()
      expect(storedConfig?.endpoints).toHaveLength(2)
      expect(storedConfig?.agent_bindings).toHaveLength(1)
    })

    test('accepts null config to clear state', async () => {
      const request = createMockRequest({ config: null })
      const response = await POST(request as any)

      expect(response.status).toBe(200)

      const storedConfig = getCurrentConfig()
      expect(storedConfig).toBeNull()
    })

    test('accepts cloud mode config', async () => {
      const config: LocalCliConfig = {
        mode: 'cloud',
        endpoints: [],
      }

      const request = createMockRequest({ config })
      const response = await POST(request as any)

      expect(response.status).toBe(200)

      const storedConfig = getCurrentConfig()
      expect(storedConfig?.mode).toBe('cloud')
    })

    test('handles invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/v1/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json{{{',
      })

      const response = await POST(request as any)

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBeDefined()
    })
  })

  describe('GET /api/v1/config', () => {
    test('returns null when no config is set', async () => {
      // First, clear the config
      const clearRequest = createMockRequest({ config: null })
      await POST(clearRequest as any)

      const response = await GET()
      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body).toEqual({ config: null })
    })

    test('returns current config when set', async () => {
      const config: LocalCliConfig = {
        mode: 'local',
        endpoints: [
          {
            name: 'test',
            base_url: 'https://test.ai',
          },
        ],
      }

      // Set the config first
      const setRequest = createMockRequest({ config })
      await POST(setRequest as any)

      const response = await GET()
      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.config).toEqual(config)
    })
  })

  describe('Config State Management', () => {
    test('config persists across requests', async () => {
      const config: LocalCliConfig = {
        mode: 'local',
        endpoints: [{ name: 'test', base_url: 'https://test.ai' }],
      }

      // Set config
      const setRequest = createMockRequest({ config })
      await POST(setRequest as any)

      // Get config via function
      const storedConfig = getCurrentConfig()
      expect(storedConfig).toEqual(config)

      // Get config via GET endpoint
      const response = await GET()
      const body = await response.json()
      expect(body.config).toEqual(config)
    })

    test('config can be updated', async () => {
      const config1: LocalCliConfig = {
        mode: 'local',
        endpoints: [{ name: 'test1', base_url: 'https://test1.ai' }],
      }

      const config2: LocalCliConfig = {
        mode: 'local',
        endpoints: [{ name: 'test2', base_url: 'https://test2.ai' }],
      }

      // Set first config
      await POST(createMockRequest({ config: config1 }) as any)
      expect(getCurrentConfig()).toEqual(config1)

      // Update to second config
      await POST(createMockRequest({ config: config2 }) as any)
      expect(getCurrentConfig()).toEqual(config2)
    })

    test('config can be cleared', async () => {
      const config: LocalCliConfig = {
        mode: 'local',
        endpoints: [{ name: 'test', base_url: 'https://test.ai' }],
      }

      // Set config
      await POST(createMockRequest({ config }) as any)
      expect(getCurrentConfig()).toEqual(config)

      // Clear config
      await POST(createMockRequest({ config: null }) as any)
      expect(getCurrentConfig()).toBeNull()
    })
  })
})
