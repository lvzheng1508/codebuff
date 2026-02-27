import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { isLocalMode, skipBillingChecks } from '../local-mode'

// Mock the config route module
let mockGetCurrentConfig: ReturnType<typeof mock<typeof import('@/app/api/v1/config/route').getCurrentConfig>>

describe('Local Mode', () => {
  beforeEach(() => {
    // Create a mock for getCurrentConfig
    mockGetCurrentConfig = mock(() => null)
    // Mock the entire module
    mock.module('@/app/api/v1/config/route', () => ({
      getCurrentConfig: mockGetCurrentConfig,
      POST: mock(() => {}),
      GET: mock(() => {}),
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test('returns false when no config', () => {
    mockGetCurrentConfig.mockReturnValue(null)
    expect(isLocalMode()).toBe(false)
  })

  test('returns false when config mode is cloud', () => {
    mockGetCurrentConfig.mockReturnValue({ mode: 'cloud' } as any)
    expect(isLocalMode()).toBe(false)
  })

  test('returns true when config mode is local', () => {
    mockGetCurrentConfig.mockReturnValue({ mode: 'local' } as any)
    expect(isLocalMode()).toBe(true)
  })

  test('skips billing checks in local mode', () => {
    mockGetCurrentConfig.mockReturnValue({ mode: 'local' } as any)
    expect(skipBillingChecks()).toBe(true)
  })

  test('does not skip billing checks when no config', () => {
    mockGetCurrentConfig.mockReturnValue(null)
    expect(skipBillingChecks()).toBe(false)
  })

  test('does not skip billing checks in cloud mode', () => {
    mockGetCurrentConfig.mockReturnValue({ mode: 'cloud' } as any)
    expect(skipBillingChecks()).toBe(false)
  })
})
