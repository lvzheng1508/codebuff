import { afterEach, describe, expect, mock, test } from 'bun:test'

import type { TrackEventFn } from '@codebuff/common/types/contracts/analytics'
import type {
  ConsumeCreditsWithFallbackFn,
  GetUserUsageDataFn,
} from '@codebuff/common/types/contracts/billing'
import type { Logger } from '@codebuff/common/types/contracts/logger'

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key'
process.env.GRAVITY_API_KEY = process.env.GRAVITY_API_KEY || 'test-key'
process.env.STRIPE_SUBSCRIPTION_100_PRICE_ID =
  process.env.STRIPE_SUBSCRIPTION_100_PRICE_ID || 'price_test_100'
process.env.STRIPE_SUBSCRIPTION_200_PRICE_ID =
  process.env.STRIPE_SUBSCRIPTION_200_PRICE_ID || 'price_test_200'
process.env.STRIPE_SUBSCRIPTION_500_PRICE_ID =
  process.env.STRIPE_SUBSCRIPTION_500_PRICE_ID || 'price_test_500'

describe('api v1 helpers', () => {
  afterEach(() => {
    mock.restore()
  })

  test('checkCreditsAndCharge bypasses charging in local mode', async () => {
    const { checkCreditsAndCharge } = require('../_helpers')

    const logger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
    } as unknown as Logger
    const trackEvent = mock(() => {}) as unknown as TrackEventFn
    const getUserUsageData = mock(async () => {
      throw new Error('should not be called in local mode')
    }) as unknown as GetUserUsageDataFn
    const consumeCreditsWithFallback = mock(async () => {
      throw new Error('should not be called in local mode')
    }) as unknown as ConsumeCreditsWithFallbackFn

    const result = await checkCreditsAndCharge({
      userId: 'local-mode-user',
      creditsToCharge: 999,
      context: 'test',
      logger,
      trackEvent,
      insufficientCreditsEvent: 'test_event' as any,
      getUserUsageData,
      consumeCreditsWithFallback,
      skipBillingChecksOverride: true,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.creditsUsed).toBe(0)
    }
    expect(getUserUsageData.mock.calls.length).toBe(0)
    expect(consumeCreditsWithFallback.mock.calls.length).toBe(0)
  })

  test('checkCreditsAndCharge still enforces credits outside local mode', async () => {
    const { checkCreditsAndCharge } = require('../_helpers')

    const logger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
    } as unknown as Logger
    const trackEvent = mock(() => {}) as unknown as TrackEventFn
    const getUserUsageData = mock(async () => ({
      usageThisCycle: 0,
      balance: {
        totalRemaining: 0,
        totalDebt: 0,
        netBalance: 0,
        breakdown: {},
      },
      nextQuotaReset: 'soon',
    })) as unknown as GetUserUsageDataFn
    const consumeCreditsWithFallback = mock(async () => ({
      success: true,
      value: { chargedToOrganization: false },
    })) as unknown as ConsumeCreditsWithFallbackFn

    const result = await checkCreditsAndCharge({
      userId: 'cloud-user',
      creditsToCharge: 1,
      context: 'test',
      logger,
      trackEvent,
      insufficientCreditsEvent: 'test_event' as any,
      getUserUsageData,
      consumeCreditsWithFallback,
      skipBillingChecksOverride: false,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(402)
    }
  })
})
