import { skipBillingChecks } from './local-mode'

/**
 * Check if authentication should be bypassed for local mode.
 * In local mode, users provide their own LLM endpoints and don't need
 * to authenticate with Codebuff's cloud service.
 */
export function shouldBypassAuth(): boolean {
  return skipBillingChecks() // Same condition: local mode
}

/**
 * Create a special auth token for local mode.
 * This token is used to identify local mode requests without requiring
 * actual user authentication.
 */
export function createLocalAuthToken(): string {
  return 'local-mode-token'
}
