import { isLocalModeSync } from './config/load-config'
import { clientEnvSchema, getClientProcessEnv } from './env-schema'

const isCI = process.env.CI === 'true' || process.env.CI === '1'
const shouldProvideDefaults =
  isCI || isLocalModeSync() || process.env.NODE_ENV !== 'production'

if (shouldProvideDefaults) {
  const ensureEnvDefault = (key: string, value: string) => {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }

  ensureEnvDefault('NEXT_PUBLIC_CB_ENVIRONMENT', 'dev')
  ensureEnvDefault('NEXT_PUBLIC_CODEBUFF_APP_URL', 'http://localhost:3000')
  ensureEnvDefault('NEXT_PUBLIC_SUPPORT_EMAIL', 'support@codebuff.local')
  ensureEnvDefault('NEXT_PUBLIC_POSTHOG_API_KEY', 'disabled')
  ensureEnvDefault('NEXT_PUBLIC_POSTHOG_HOST_URL', 'http://localhost')
  ensureEnvDefault('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_disabled')
  ensureEnvDefault('NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL', 'http://localhost')
  ensureEnvDefault('NEXT_PUBLIC_WEB_PORT', '3000')
}

if (process.env.NEXT_PUBLIC_CB_ENVIRONMENT === 'local') {
  process.env.NEXT_PUBLIC_CB_ENVIRONMENT = 'dev'
}

const parsedEnv = clientEnvSchema.safeParse(getClientProcessEnv())
if (!parsedEnv.success) {
  throw parsedEnv.error
}

export const env = parsedEnv.data

// Only log environment in non-production
if (env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod') {
  console.log('Using environment:', env.NEXT_PUBLIC_CB_ENVIRONMENT)
}

// Derived environment constants for convenience
export const IS_DEV = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'dev'
export const IS_TEST = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'test'
export const IS_PROD = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'prod'
export const IS_CI = process.env.CODEBUFF_GITHUB_ACTIONS === 'true'

// Debug flag for logging analytics events in dev mode
// Set to true when actively debugging analytics - affects both CLI and backend
export const DEBUG_ANALYTICS = false
