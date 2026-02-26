import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import { loadLocalConfig } from '../load-config'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

describe('loadLocalConfig', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codebuff-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true })
  })

  test('returns null when no config file exists', async () => {
    const originalCwd = process.cwd()
    process.chdir(tempDir)
    const result = await loadLocalConfig()
    process.chdir(originalCwd)

    expect(result).toBeNull()
  })

  test('loads JSON config file', async () => {
    const config = {
      mode: 'local',
      endpoints: [{ name: 'openai', base_url: 'https://api.openai.com' }],
    }
    const configPath = path.join(tempDir, 'codebuff.local.json')
    await fs.writeFile(configPath, JSON.stringify(config))

    const originalCwd = process.cwd()
    process.chdir(tempDir)
    const result = await loadLocalConfig()
    process.chdir(originalCwd)

    expect(result).toEqual(config)
  })

  test('loads YAML config file', async () => {
    const configContent = `
mode: local
endpoints:
  - name: openai
    base_url: https://api.openai.com
    api_key: sk-test123
    model: gpt-4
`
    const configPath = path.join(tempDir, 'codebuff.local.yaml')
    await fs.writeFile(configPath, configContent)

    const originalCwd = process.cwd()
    process.chdir(tempDir)
    const result = await loadLocalConfig()
    process.chdir(originalCwd)

    expect(result).toEqual({
      mode: 'local',
      endpoints: [
        {
          name: 'openai',
          base_url: 'https://api.openai.com',
          api_key: 'sk-test123',
          model: 'gpt-4',
        },
      ],
    })
  })

  test('finds config in parent directory', async () => {
    const config = {
      mode: 'local',
      default_endpoint: 'openai',
      endpoints: [{ name: 'openai', base_url: 'https://api.openai.com' }],
      agent_bindings: [
        { agent_id: 'agent-1', endpoint: 'openai', model: 'gpt-4' },
      ],
    }
    const configPath = path.join(tempDir, 'codebuff.local.json')
    await fs.writeFile(configPath, JSON.stringify(config))

    // Create a subdirectory and change into it
    const subDir = path.join(tempDir, 'subdir')
    await fs.mkdir(subDir)

    const originalCwd = process.cwd()
    process.chdir(subDir)
    const result = await loadLocalConfig()
    process.chdir(originalCwd)

    expect(result).toEqual(config)
  })

  test('prioritizes config in current directory over parent', async () => {
    const parentConfig = {
      mode: 'local',
      endpoints: [{ name: 'parent', base_url: 'https://parent.example.com' }],
    }
    const currentConfig = {
      mode: 'local',
      endpoints: [{ name: 'current', base_url: 'https://current.example.com' }],
    }

    const parentConfigPath = path.join(tempDir, 'codebuff.local.json')
    await fs.writeFile(parentConfigPath, JSON.stringify(parentConfig))

    const subDir = path.join(tempDir, 'subdir')
    await fs.mkdir(subDir)
    const currentConfigPath = path.join(subDir, 'codebuff.local.json')
    await fs.writeFile(currentConfigPath, JSON.stringify(currentConfig))

    const originalCwd = process.cwd()
    process.chdir(subDir)
    const result = await loadLocalConfig()
    process.chdir(originalCwd)

    expect(result).toEqual(currentConfig)
  })

  test('prioritizes YAML over JSON in same directory', async () => {
    const yamlConfig = {
      mode: 'local',
      endpoints: [{ name: 'yaml', base_url: 'https://yaml.example.com' }],
    }
    const jsonConfig = {
      mode: 'local',
      endpoints: [{ name: 'json', base_url: 'https://json.example.com' }],
    }

    const yamlPath = path.join(tempDir, 'codebuff.local.yaml')
    await fs.writeFile(yamlPath, `mode: local
endpoints:
  - name: yaml
    base_url: https://yaml.example.com`)

    const jsonPath = path.join(tempDir, 'codebuff.local.json')
    await fs.writeFile(jsonPath, JSON.stringify(jsonConfig))

    const originalCwd = process.cwd()
    process.chdir(tempDir)
    const result = await loadLocalConfig()
    process.chdir(originalCwd)

    expect(result).toEqual(yamlConfig)
  })
})
