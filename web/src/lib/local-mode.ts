import { getCurrentConfig } from '@/app/api/v1/config/route'

/**
 * Check if the application is running in local mode.
 * Local mode means the CLI is configured to use local LLM endpoints
 * and should skip certain cloud-only features like billing checks.
 */
export function isLocalMode(): boolean {
  const config = getCurrentConfig()
  return config?.mode === 'local'
}

/**
 * Determine whether billing/credits checks should be skipped.
 * In local mode, users provide their own LLM endpoints, so we don't
 * need to check their Codebuff account balance.
 */
export function skipBillingChecks(): boolean {
  return isLocalMode()
}
