import fs from 'fs/promises'
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
