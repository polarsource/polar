import { afterEach, expect, test, vi } from 'vitest'
import { getMeterId } from './meters'
import { createPolar } from '../../sdk'

afterEach(() => vi.restoreAllMocks())

test.each([
  ['missing', [], 'not deployed'],
  [
    'ambiguous',
    [
      { id: 'first', external_id: 'tokens' },
      { id: 'second', external_id: 'tokens' },
    ],
    'ambiguous',
  ],
])(
  'rejects %s external IDs instead of reading the wrong balance',
  async (_, items, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ items, pagination: { max_page: 1 } }),
    )
    await expect(
      getMeterId(createPolar({ accessToken: 'test' }), 'tokens'),
    ).rejects.toThrow(String(message))
  },
)
