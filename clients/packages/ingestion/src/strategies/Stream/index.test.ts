import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

import { StreamStrategy } from '.'
import { Ingestion } from '../../ingestion'

describe('StreamStrategy', () => {
  it('should log a failed ingest instead of rejecting', async () => {
    const strategy = Ingestion()
      .strategy(new StreamStrategy(Readable.from([Buffer.from('hello')])))
      .ingest('stream-bytes')
    vi.spyOn(strategy.polarClient!.events, 'ingest').mockRejectedValue(
      new Error('Polar is down'),
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    strategy.client({ customerId: 'test-customer-id' })

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1))
  })
})
