import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { existsSync } from 'fs'
import { z } from 'zod'
import type { LocalCliConfig } from './local-config.types'

// Zod schema for validating local config
const LocalEndpointSchema = z.object({
  name: z.string(),
  base_url: z.string().url(),
  api_key: z.string().optional(),
  model: z.string().optional(),
})

const AgentModelBindingSchema = z.object({
  agent_id: z.string(),
  endpoint: z.string(),
  model: z.string().optional(),
})

const LocalConfigSchema = z.object({
  mode: z.enum(['local', 'cloud']),
  default_endpoint: z.string().optional(),
  endpoints: z.array(LocalEndpointSchema).min(1, 'At least one endpoint is required'),
  agent_bindings: z.array(AgentModelBindingSchema).optional(),
})

function getConfigPaths(): string[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  const xdgConfigHome =
    process.env.XDG_CONFIG_HOME ||
    (homeDir ? path.join(homeDir, '.config') : '')
  const globalConfigDir = path.join(xdgConfigHome, 'manicode')
  const globalFiles = [
    path.join(globalConfigDir, 'codebuff.local.json'),
    path.join(globalConfigDir, 'codebuff.local.yaml'),
    ...(homeDir
      ? [
          path.join(homeDir, '.codebuff.local.json'),
          path.join(homeDir, '.codebuff.local.yaml'),
        ]
      : []),
  ]

  return Array.from(new Set(globalFiles))
}

export async function loadLocalConfig(): Promise<LocalCliConfig | null> {
  for (const configPath of getConfigPaths()) {
    if (existsSync(configPath)) {
      try {
        const content = await fs.readFile(configPath, 'utf-8')
        let parsed: unknown

        if (configPath.endsWith('.json')) {
          parsed = JSON.parse(content)
        } else {
          // YAML parsing - use js-yaml
          const yaml = (await import('js-yaml')).default
          parsed = yaml.load(content)
        }

        // Validate the parsed config against the schema
        return LocalConfigSchema.parse(parsed)
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formattedErrors = error.issues.map((issue) => {
            const path = issue.path.join('.')
            return `  - ${path}: ${issue.message}`
          }).join('\n')
          throw new Error(
            `Invalid config in ${configPath}:\n${formattedErrors}`
          )
        }
        // Re-throw other errors (JSON/YAML parse errors, file read errors, etc.)
        throw error
      }
    }
  }
  return null
}

/**
 * Synchronously load and validate local config from known locations.
 * Returns null when no config file is found.
 */
export function loadLocalConfigSync(): LocalCliConfig | null {
  for (const configPath of getConfigPaths()) {
    if (!existsSync(configPath)) {
      continue
    }
    try {
      const content = fsSync.readFileSync(configPath, 'utf-8')
      let parsed: unknown

      if (configPath.endsWith('.json')) {
        parsed = JSON.parse(content)
      } else {
        const yaml = require('js-yaml')
        parsed = yaml.load(content)
      }
      return LocalConfigSchema.parse(parsed)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues
          .map((issue) => {
            const path = issue.path.join('.')
            return `  - ${path}: ${issue.message}`
          })
          .join('\n')
        throw new Error(`Invalid config in ${configPath}:\n${formattedErrors}`)
      }
      throw error
    }
  }
  return null
}

/**
 * Create the local mode authentication token.
 * This token is used to bypass authentication when running in local mode.
 */
export function createLocalAuthToken(): string {
  return 'local-mode-token'
}

/**
 * Synchronously check if we're in local mode by reading the config file.
 * This is a simplified check that only looks at the mode field.
 * Note: This does NOT perform full validation - for that, use loadLocalConfig().
 */
export function isLocalModeSync(): boolean {
  try {
    const config = loadLocalConfigSync()
    return config?.mode === 'local'
  } catch {
    // If we can't read the config, assume not in local mode
    return false
  }
}
