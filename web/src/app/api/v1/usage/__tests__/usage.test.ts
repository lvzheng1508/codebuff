import { afterEach, describe, expect, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'

import { postUsage } from '../_post'

import type { TrackEventFn } from '@codebuff/common/types/contracts/analytics'
import type {
  GetOrganizationUsageResponseFn,
  GetUserUsageDataFn,
} from '@codebuff/common/types/contracts/billing'
import type { GetUserInfoFromApiKeyFn } from '@codebuff/common/types/contracts/database'
import type { Logger } from '@codebuff/common/types/contracts/logger'

describe('/api/v1/usage POST endpoint', () => {
  afterEach(() => {
    mock.restore()
  })

  test('returns local usage response for local auth token', async () => {
    const logger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
    } as unknown as Logger
    const getUserInfoFromApiKey = mock(async () => null) as unknown as GetUserInfoFromApiKeyFn
    const getUserUsageData = mock(async () => {
      throw new Error('should not be called in local mode')
    }) as unknown as GetUserUsageDataFn
    const getOrganizationUsageResponse = mock(async () => {
      throw new Error('should not be called in local mode')
    }) as unknown as GetOrganizationUsageResponseFn
    const trackEvent = mock(() => {}) as unknown as TrackEventFn

    const req = new NextRequest('http://localhost:3000/api/v1/usage', {
      method: 'POST',
      body: JSON.stringify({
        fingerprintId: 'cli-usage',
        authToken: 'local-mode-token',
      }),
    })

    const res = await postUsage({
      req,
      getUserInfoFromApiKey,
      getUserUsageData,
      getOrganizationUsageResponse,
      trackEvent,
      logger,
      shouldBypassAuthOverride: true,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe('usage-response')
    expect(body.usage).toBe(0)
    expect(body.remainingBalance).toBeNull()
    expect(getUserInfoFromApiKey.mock.calls.length).toBe(0)
  })
})
