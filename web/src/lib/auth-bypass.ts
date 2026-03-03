import { skipBillingChecks } from './local-mode'
import { createLocalAuthToken } from '@codebuff/common/config/load-config'

/**
 * Check if authentication should be bypassed for local mode.
 * In local mode, users provide their own LLM endpoints and don't need
 * to authenticate with Codebuff's cloud service.
 */
export function shouldBypassAuth(): boolean {
  return skipBillingChecks() // Same condition: local mode
}

/**
 * Accept local auth token whenever local mode is enabled.
 * In non-production, also allow it as a dev fallback to avoid DB auth coupling.
 */
export function isLocalAuthToken(apiKey: string | null | undefined): boolean {
  if (!apiKey || apiKey !== createLocalAuthToken()) {
    return false
  }
  if (shouldBypassAuth()) {
    return true
  }
  return process.env.NODE_ENV !== 'production'
}

// Re-export createLocalAuthToken for convenience
export { createLocalAuthToken }
