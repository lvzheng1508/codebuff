import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

import { loadLocalConfig } from '@codebuff/common/config/load-config'
import { initializeConfig } from '../utils/codebuff-api'
import { resetApiClient } from '../utils/codebuff-api'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

// Mock the logger to prevent analytics initialization errors in tests
mock.module('../utils/logger', () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
  },
}))

describe('Local Mode E2E', () => {
  let tempDir: string
  let originalCwd: string
  let originalFetch: typeof fetch

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codebuff-e2e-'))
    originalCwd = process.cwd()
    originalFetch = globalThis.fetch
    resetApiClient()
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await fs.rm(tempDir, { recursive: true, force: true })
    globalThis.fetch = originalFetch
    resetApiClient()
    mock.restore()
  })

  describe('Config Loading', () => {
    test('loads and parses JSON config file', async () => {
      const config = {
        mode: 'local' as const,
        endpoints: [
          { name: 'test', base_url: 'https://test.ai', api_key: 'test-key' },
        ],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded).toEqual(config)
    })

    test('loads and parses YAML config file', async () => {
      const yamlContent = `
mode: local
endpoints:
  - name: openai
    base_url: https://api.openai.com
    api_key: sk-test123
    model: gpt-4
default_endpoint: openai
`
      const configPath = path.join(tempDir, 'codebuff.local.yaml')
      await fs.writeFile(configPath, yamlContent)

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded).toEqual({
        mode: 'local',
        endpoints: [
          {
            name: 'openai',
            base_url: 'https://api.openai.com',
            api_key: 'sk-test123',
            model: 'gpt-4',
          },
        ],
        default_endpoint: 'openai',
      })
    })

    test('returns null when no config file exists', async () => {
      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded).toBeNull()
    })

    test('finds config in parent directory', async () => {
      const config = {
        mode: 'local' as const,
        endpoints: [{ name: 'test', base_url: 'https://test.ai' }],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      // Create a subdirectory and change into it
      const subDir = path.join(tempDir, 'subdir')
      await fs.mkdir(subDir)
      process.chdir(subDir)

      const loaded = await loadLocalConfig()
      expect(loaded).toEqual(config)
    })

    test('prioritizes YAML over JSON in same directory', async () => {
      const yamlContent = `
mode: local
endpoints:
  - name: yaml-endpoint
    base_url: https://yaml.example.com
`
      const jsonConfig = {
        mode: 'local' as const,
        endpoints: [{ name: 'json-endpoint', base_url: 'https://json.example.com' }],
      }

      const yamlPath = path.join(tempDir, 'codebuff.local.yaml')
      await fs.writeFile(yamlPath, yamlContent)

      const jsonPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(jsonPath, JSON.stringify(jsonConfig))

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded?.endpoints[0].name).toBe('yaml-endpoint')
    })
  })

  describe('Config Validation', () => {
    test('handles config with multiple endpoints', async () => {
      const config = {
        mode: 'local' as const,
        default_endpoint: 'openai',
        endpoints: [
          { name: 'openai', base_url: 'https://api.openai.com', api_key: 'sk-1' },
          { name: 'anthropic', base_url: 'https://api.anthropic.com', api_key: 'sk-2' },
        ],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded?.endpoints).toHaveLength(2)
      expect(loaded?.default_endpoint).toBe('openai')
    })

    test('handles config with agent bindings', async () => {
      const config = {
        mode: 'local' as const,
        endpoints: [{ name: 'openai', base_url: 'https://api.openai.com' }],
        agent_bindings: [
          { agent_id: 'agent-1', endpoint: 'openai', model: 'gpt-4' },
          { agent_id: 'agent-2', endpoint: 'openai', model: 'gpt-3.5' },
        ],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded?.agent_bindings).toHaveLength(2)
      expect(loaded?.agent_bindings?.[0].model).toBe('gpt-4')
    })

    test('handles endpoint with optional model field', async () => {
      const config = {
        mode: 'local' as const,
        endpoints: [
          { name: 'test', base_url: 'https://test.ai', api_key: 'key', model: 'gpt-4' },
        ],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded?.endpoints[0].model).toBe('gpt-4')
    })

    test('handles endpoint without optional fields', async () => {
      const config = {
        mode: 'local' as const,
        endpoints: [{ name: 'test', base_url: 'https://test.ai' }],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded?.endpoints[0].api_key).toBeUndefined()
      expect(loaded?.endpoints[0].model).toBeUndefined()
    })
  })

  describe('Backend Communication', () => {
    test('sends config to backend on initialization', async () => {
      const config = {
        mode: 'local' as const,
        endpoints: [{ name: 'test', base_url: 'https://test.ai', api_key: 'key' }],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      // Mock fetch to capture the config sent to backend
      const fetchMock = mock(async (url: string | Request, init?: RequestInit) => {
        const urlStr = url instanceof Request ? url.url : url
        if (urlStr.includes('/api/v1/config')) {
          const body = init?.body ? JSON.parse(init.body as string) : {}
          expect(body.config).toEqual(config)
          return new Response(JSON.stringify({ success: true }), { status: 200 })
        }
        return new Response(JSON.stringify({}), { status: 200 })
      })
      globalThis.fetch = fetchMock as unknown as typeof fetch

      const result = await initializeConfig()

      expect(result).toEqual(config)
      // Verify the config endpoint was called
      const configCall = fetchMock.mock.calls.some(([url]) => {
        const urlStr = url instanceof Request ? url.url : url
        return urlStr.includes('/api/v1/config')
      })
      expect(configCall).toBe(true)
    })

    test('handles backend config send failure gracefully', async () => {
      const config = {
        mode: 'local' as const,
        endpoints: [{ name: 'test', base_url: 'https://test.ai' }],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      // Mock fetch to fail on config endpoint
      const fetchMock = mock(async () => {
        return new Response(null, { status: 500 })
      })
      globalThis.fetch = fetchMock as unknown as typeof fetch

      // Should not throw, should return null on error
      const result = await initializeConfig()
      // The function catches errors and returns null
      expect(result).toBeNull()
    })

    test('returns null when no config file exists during initialization', async () => {
      process.chdir(tempDir)

      const fetchMock = mock(async () => {
        return new Response(JSON.stringify({}), { status: 200 })
      })
      globalThis.fetch = fetchMock as unknown as typeof fetch

      const result = await initializeConfig()
      expect(result).toBeNull()
    })
  })

  describe('Cloud Mode', () => {
    test('recognizes cloud mode in config', async () => {
      const config = {
        mode: 'cloud' as const,
        endpoints: [{ name: 'test', base_url: 'https://test.ai' }],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded?.mode).toBe('cloud')
    })

    test('sends cloud mode config to backend', async () => {
      const config = {
        mode: 'cloud' as const,
        endpoints: [{ name: 'test', base_url: 'https://test.ai' }],
      }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      const fetchMock = mock(async (url: string | Request, init?: RequestInit) => {
        const urlStr = url instanceof Request ? url.url : url
        if (urlStr.includes('/api/v1/config')) {
          const body = init?.body ? JSON.parse(init.body as string) : {}
          expect(body.config?.mode).toBe('cloud')
          return new Response(JSON.stringify({ success: true }), { status: 200 })
        }
        return new Response(JSON.stringify({}), { status: 200 })
      })
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await initializeConfig()
    })
  })

  describe('Edge Cases', () => {
    test('handles malformed JSON gracefully', async () => {
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, '{ invalid json }')

      process.chdir(tempDir)

      // Malformed JSON will throw when parsing
      await expect(loadLocalConfig()).rejects.toThrow()
    })

    test('handles malformed YAML gracefully', async () => {
      const yamlContent = `
mode: local
endpoints:
  - name: test
    base_url: https://test.ai
    invalid_yaml_structure: [
`
      const configPath = path.join(tempDir, 'codebuff.local.yaml')
      await fs.writeFile(configPath, yamlContent)

      process.chdir(tempDir)

      // Malformed YAML will throw when parsing
      await expect(loadLocalConfig()).rejects.toThrow()
    })

    test('handles empty config file', async () => {
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, '{}')

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      // Empty config is still valid (just missing fields)
      expect(loaded).toBeDefined()
    })

    test('handles config with only mode field', async () => {
      const config = { mode: 'local' as const, endpoints: [] }
      const configPath = path.join(tempDir, 'codebuff.local.json')
      await fs.writeFile(configPath, JSON.stringify(config))

      process.chdir(tempDir)

      const loaded = await loadLocalConfig()
      expect(loaded?.mode).toBe('local')
      expect(loaded?.endpoints).toEqual([])
    })
  })
})
