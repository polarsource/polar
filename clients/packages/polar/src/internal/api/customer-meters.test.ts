import { afterEach, expect, test, vi } from 'vitest'
import { getCustomerMeter } from './customer-meters'
import { createPolar } from '../../sdk'

afterEach(() => vi.restoreAllMocks())

test('rejects ambiguous external meter IDs instead of reading the wrong balance', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ items: [{ id: 'first' }, { id: 'second' }] }),
  )
  await expect(
    getCustomerMeter(
      createPolar({ accessToken: 'test' }),
      { external_customer_id: 'customer-1' },
      'tokens',
    ),
  ).rejects.toThrow('ambiguous')
})
