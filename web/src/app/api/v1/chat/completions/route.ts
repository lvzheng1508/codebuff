import { trackEvent } from '@codebuff/common/analytics'

import { postChatCompletions } from './_post'

import type { GetUserPreferencesFn } from './_post'
import type { InsertMessageBigqueryFn } from '@codebuff/common/types/contracts/bigquery'
import type { GetUserUsageDataFn } from '@codebuff/common/types/contracts/billing'
import type { NextRequest } from 'next/server'

import { skipBillingChecks } from '@/lib/local-mode'
import { logger, loggerWithContext } from '@/util/logger'

export async function POST(req: NextRequest) {
  const isLocal = skipBillingChecks()
  if (isLocal) {
    const getUserUsageDataLocal: GetUserUsageDataFn = async () => ({
      usageThisCycle: 0,
      balance: {
        totalRemaining: 0,
        totalDebt: 0,
        netBalance: 0,
        breakdown: {},
      },
      nextQuotaReset: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    const insertMessageBigqueryLocal: InsertMessageBigqueryFn = async () => true

    return postChatCompletions({
      req,
      getUserInfoFromApiKey: async () => null,
      logger,
      loggerWithContext,
      trackEvent,
      getUserUsageData: getUserUsageDataLocal,
      getAgentRunFromId: async () => null,
      fetch,
      insertMessageBigquery: insertMessageBigqueryLocal,
      ensureSubscriberBlockGrant: undefined,
      getUserPreferences: undefined,
    })
  }

  const [
    dbMod,
    schemaMod,
    drizzleMod,
    userMod,
    agentRunMod,
    billingUsageMod,
    billingSubMod,
    bigqueryMod,
  ] = await Promise.all([
    import('@codebuff/internal/db'),
    import('@codebuff/internal/db/schema'),
    import('drizzle-orm'),
    import('@/db/user'),
    import('@/db/agent-run'),
    import('@codebuff/billing/usage-service'),
    import('@codebuff/billing/subscription'),
    import('@codebuff/bigquery'),
  ])

  const getUserPreferences: GetUserPreferencesFn = async ({ userId }) => {
    const userPrefs = await dbMod.default.query.user.findFirst({
      where: drizzleMod.eq(schemaMod.user.id, userId),
      columns: { fallback_to_a_la_carte: true },
    })
    return {
      fallbackToALaCarte: userPrefs?.fallback_to_a_la_carte ?? false,
    }
  }

  return postChatCompletions({
    req,
    getUserInfoFromApiKey: userMod.getUserInfoFromApiKey,
    logger,
    loggerWithContext,
    trackEvent,
    getUserUsageData: billingUsageMod.getUserUsageData,
    getAgentRunFromId: agentRunMod.getAgentRunFromId,
    fetch,
    insertMessageBigquery: bigqueryMod.insertMessageBigquery,
    ensureSubscriberBlockGrant: billingSubMod.ensureSubscriberBlockGrant,
    getUserPreferences,
  })
}
