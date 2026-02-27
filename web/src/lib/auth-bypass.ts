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

// Re-export createLocalAuthToken for convenience
export { createLocalAuthToken }
