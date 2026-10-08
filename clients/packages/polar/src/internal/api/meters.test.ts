import { afterEach, expect, test, vi } from 'vitest'
import { assertMeterDeployed } from './meters'
import { createPolar } from '../../sdk'

afterEach(() => vi.restoreAllMocks())

const sdk = createPolar({ accessToken: 'test' })

test('looks up the meter by external ID', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ id: 'meter-id', archived_at: null }))
  await expect(assertMeterDeployed(sdk, 'tokens')).resolves.toBeUndefined()
  expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toBe(
    '/v1/meters/external/tokens',
  )
})

test.each([
  [
    'missing',
    Response.json(
      { error: 'ResourceNotFound', detail: 'Not found' },
      { status: 404 },
    ),
    'not deployed',
  ],
  [
    'archived',
    Response.json({ id: 'meter-id', archived_at: '2026-10-01T00:00:00Z' }),
    'not deployed',
  ],
  [
    'ambiguous',
    Response.json(
      { error: 'AmbiguousExternalMeterID', detail: 'Ambiguous' },
      { status: 409 },
    ),
    'ambiguous',
  ],
])(
  'rejects %s external IDs instead of reading the wrong balance',
  async (_, response, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
    await expect(assertMeterDeployed(sdk, 'tokens')).rejects.toThrow(message)
  },
)
