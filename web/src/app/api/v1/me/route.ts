import { trackEvent } from '@codebuff/common/analytics'

import { getMe } from './_get'

import type { NextRequest } from 'next/server'

import { skipBillingChecks } from '@/lib/local-mode'
import { logger } from '@/util/logger'

export async function GET(req: NextRequest) {
  const getUserInfoFromApiKey = skipBillingChecks()
    ? (async () => null)
    : (await import('@/db/user')).getUserInfoFromApiKey
  return getMe({ req, getUserInfoFromApiKey, logger, trackEvent })
}
