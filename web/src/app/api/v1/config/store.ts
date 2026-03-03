import type { LocalCliConfig } from '@codebuff/common/config/local-config.types'

let currentConfig: LocalCliConfig | null = null

export function setCurrentConfig(config: LocalCliConfig | null): void {
  currentConfig = config
}

export function getCurrentConfig(): LocalCliConfig | null {
  return currentConfig
}
