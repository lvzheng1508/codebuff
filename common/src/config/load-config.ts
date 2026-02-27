import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { existsSync } from 'fs'
import type { LocalCliConfig } from './local-config.types'

function getConfigPaths(): string[] {
  return [
    path.join(process.cwd(), 'codebuff.local.yaml'),
    path.join(process.cwd(), 'codebuff.local.json'),
    path.join(process.cwd(), '../codebuff.local.yaml'),
    path.join(process.cwd(), '../codebuff.local.json'),
  ]
}

export async function loadLocalConfig(): Promise<LocalCliConfig | null> {
  for (const configPath of getConfigPaths()) {
    if (existsSync(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8')
      if (configPath.endsWith('.json')) {
        return JSON.parse(content) as LocalCliConfig
      } else {
        // YAML parsing - use js-yaml
        const yaml = (await import('js-yaml')).default
        return yaml.load(content) as LocalCliConfig
      }
    }
  }
  return null
}

/**
 * Synchronously check if we're in local mode by reading the config file.
 * This is a simplified check that only looks at the mode field.
 */
export function isLocalModeSync(): boolean {
  for (const configPath of getConfigPaths()) {
    if (existsSync(configPath)) {
      try {
        const content = fsSync.readFileSync(configPath, 'utf-8')
        let config: LocalCliConfig
        if (configPath.endsWith('.json')) {
          config = JSON.parse(content) as LocalCliConfig
        } else {
          // YAML parsing - use js-yaml
          const yaml = require('js-yaml')
          config = yaml.load(content) as LocalCliConfig
        }
        return config?.mode === 'local'
      } catch (error) {
        // If we can't read the config, assume not in local mode
        return false
      }
    }
  }
  return false
}
