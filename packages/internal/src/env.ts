import { isLocalModeSync } from '@codebuff/common/config/load-config'

import { getServerProcessEnv, serverEnvSchema } from './env-schema'

const isCI = process.env.CI === 'true' || process.env.CI === '1'
const shouldProvideDefaults =
  isCI || isLocalModeSync() || process.env.NODE_ENV !== 'production'

if (shouldProvideDefaults) {
  const ensureEnvDefault = (key: string, value: string) => {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }

  ensureEnvDefault('OPEN_ROUTER_API_KEY', 'test')
  ensureEnvDefault('OPENAI_API_KEY', 'test')
  ensureEnvDefault('ANTHROPIC_API_KEY', 'test')
  ensureEnvDefault('LINKUP_API_KEY', 'test')
  ensureEnvDefault('GRAVITY_API_KEY', 'test')
  ensureEnvDefault('NEXT_PUBLIC_CB_ENVIRONMENT', 'dev')
  ensureEnvDefault('NEXT_PUBLIC_CODEBUFF_APP_URL', 'http://localhost:3000')
  ensureEnvDefault('NEXT_PUBLIC_SUPPORT_EMAIL', 'support@codebuff.local')
  ensureEnvDefault('NEXT_PUBLIC_POSTHOG_API_KEY', 'disabled')
  ensureEnvDefault('NEXT_PUBLIC_POSTHOG_HOST_URL', 'http://localhost')
  ensureEnvDefault('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_disabled')
  ensureEnvDefault('NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL', 'http://localhost')
  ensureEnvDefault('NEXT_PUBLIC_WEB_PORT', '3000')
  ensureEnvDefault('PORT', '4242')
  ensureEnvDefault('DATABASE_URL', 'postgres://user:pass@localhost:5432/db')
  ensureEnvDefault('CODEBUFF_GITHUB_ID', 'test-id')
  ensureEnvDefault('CODEBUFF_GITHUB_SECRET', 'test-secret')
  ensureEnvDefault('NEXTAUTH_SECRET', 'test-secret')
  ensureEnvDefault('STRIPE_SECRET_KEY', 'sk_test_dummy')
  ensureEnvDefault('STRIPE_WEBHOOK_SECRET_KEY', 'whsec_dummy')
  ensureEnvDefault('STRIPE_TEAM_FEE_PRICE_ID', 'price_test')
  ensureEnvDefault('STRIPE_SUBSCRIPTION_100_PRICE_ID', 'price_test_100')
  ensureEnvDefault('STRIPE_SUBSCRIPTION_200_PRICE_ID', 'price_test_200')
  ensureEnvDefault('STRIPE_SUBSCRIPTION_500_PRICE_ID', 'price_test_500')
  ensureEnvDefault('LOOPS_API_KEY', 'test')
  ensureEnvDefault('DISCORD_PUBLIC_KEY', 'test')
  ensureEnvDefault('DISCORD_BOT_TOKEN', 'test')
  ensureEnvDefault('DISCORD_APPLICATION_ID', 'test')
}

if (process.env.NEXT_PUBLIC_CB_ENVIRONMENT === 'local') {
  process.env.NEXT_PUBLIC_CB_ENVIRONMENT = 'dev'
}

// Only log environment in non-production
if (process.env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod') {
  console.log('Using environment:', process.env.NEXT_PUBLIC_CB_ENVIRONMENT)
}

export const env = serverEnvSchema.parse(getServerProcessEnv())
