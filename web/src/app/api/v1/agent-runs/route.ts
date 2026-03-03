import { trackEvent } from '@codebuff/common/analytics'

import { postAgentRuns } from './_post'

import type { NextRequest } from 'next/server'

import { skipBillingChecks } from '@/lib/local-mode'
import { logger, loggerWithContext } from '@/util/logger'

export async function POST(req: NextRequest) {
  const isLocal = skipBillingChecks()
  const getUserInfoFromApiKey = isLocal
    ? (async () => null)
    : (await import('@/db/user')).getUserInfoFromApiKey
  const db = isLocal ? ({} as any) : (await import('@codebuff/internal/db')).default

  return postAgentRuns({
    req,
    getUserInfoFromApiKey,
    logger,
    loggerWithContext,
    trackEvent,
    db,
  })
}
