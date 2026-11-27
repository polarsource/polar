import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useOrganizationSSE } from '.'

const stubFetchWithStatus = (status: number) => {
  const fetch = vi.fn(async () => new Response(null, { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useSSE', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([401, 403, 404])('stops reconnecting after a %i', async (status) => {
    const fetch = stubFetchWithStatus(status)

    const { unmount } = renderHook(() => useOrganizationSSE('org_1'))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await wait(100)
    expect(fetch).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('keeps reconnecting after a server error', async () => {
    const fetch = stubFetchWithStatus(503)

    const { unmount } = renderHook(() => useOrganizationSSE('org_1'))

    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThan(1))

    unmount()
  })
})
