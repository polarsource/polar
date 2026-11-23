import { PassThrough, Readable } from 'node:stream'
import { setImmediate } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'

import { StreamStrategy, StreamStrategyContext } from '.'
import { Ingestion } from '../../ingestion'

const trackStream = (stream: Readable) => {
  const strategy = Ingestion()
    .strategy(new StreamStrategy<Readable>(stream))
    .ingest('stream-bytes')
  const ingest = vi
    .spyOn(strategy.polarClient!.events, 'ingest')
    .mockResolvedValue({ inserted: 1 })

  return { strategy, ingest }
}

const sentEvents = (ingest: ReturnType<typeof trackStream>['ingest']) =>
  ingest.mock.calls.flatMap(([{ events }]) => events)

const consumers: Record<string, (stream: Readable) => Promise<Buffer>> = {
  "on('data')": (stream) =>
    new Promise((resolve) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    }),
  'for await': async (stream) => Buffer.concat(await stream.toArray()),
  'pipe()': (stream) => consumers['for await'](stream.pipe(new PassThrough())),
}

describe('StreamStrategy', () => {
  it('should send metadata that StreamStrategyContext accepts', async () => {
    const { strategy, ingest } = trackStream(Readable.from([Buffer.alloc(5)]))

    await strategy.client({ customerId: 'alice' }).toArray()

    const [{ metadata }] = sentEvents(ingest)
    expect(await StreamStrategyContext['~standard'].validate(metadata)).toEqual(
      { value: metadata },
    )
  })

  it.each(Object.keys(consumers))(
    'should leave the data for a consumer that reads later with %s',
    async (consumer) => {
      const source = Readable.from([Buffer.alloc(150), Buffer.alloc(50)])
      const { strategy, ingest } = trackStream(source)

      const stream = strategy.client({ customerId: 'alice' })
      await setImmediate()
      const received = await consumers[consumer](stream)

      expect(received.byteLength).toBe(200)
      expect(sentEvents(ingest)).toEqual([
        {
          customer_id: 'alice',
          name: 'stream-bytes',
          metadata: { bytes: 200, strategy: 'Stream' },
        },
      ])
    },
  )

  it('should count bytes, not characters, for string chunks', async () => {
    const text = 'héllo wörld ✓'
    const { strategy, ingest } = trackStream(Readable.from([text]))

    strategy.client({ customerId: 'alice' }).resume()

    await vi.waitFor(() => expect(ingest).toHaveBeenCalled())
    expect(sentEvents(ingest)[0].metadata).toMatchObject({
      bytes: Buffer.byteLength(text),
    })
  })

  it('should not send NaN for a stream of objects', async () => {
    const { strategy, ingest } = trackStream(
      Readable.from([{ a: 1 }, { b: 2 }]),
    )

    strategy.client({ customerId: 'alice' }).resume()

    await vi.waitFor(() => expect(ingest).toHaveBeenCalled())
    expect(sentEvents(ingest)[0].metadata).toMatchObject({ bytes: 0 })
  })

  it('should bill the first customer when client() is called twice for one stream', async () => {
    const { strategy, ingest } = trackStream(Readable.from([Buffer.alloc(10)]))

    strategy.client({ customerId: 'alice' })
    strategy.client({ customerId: 'bob' }).resume()

    await vi.waitFor(() => expect(ingest).toHaveBeenCalled())
    expect(sentEvents(ingest)).toEqual([
      expect.objectContaining({ customer_id: 'alice' }),
    ])
  })

  it('should log a failed ingest instead of rejecting', async () => {
    const { strategy, ingest } = trackStream(
      Readable.from([Buffer.from('hello')]),
    )
    ingest.mockRejectedValue(new Error('Polar is down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    strategy.client({ customerId: 'alice' }).resume()

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1))
  })
})
