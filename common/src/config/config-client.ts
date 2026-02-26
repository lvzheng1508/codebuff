import type { LocalCliConfig } from './local-config.types'

export interface ConfigRequest {
  config: LocalCliConfig | null
}

export async function sendConfigToBackend(
  config: LocalCliConfig | null,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ config }),
  })

  if (!response.ok) {
    throw new Error(`Failed to send config: ${response.statusText}`)
  }
}
