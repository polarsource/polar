import { describe, expect, it, vi } from 'vitest'

import { Ingestion } from './ingestion'
import { DeltaTimeStrategy } from './strategies/DeltaTime'

const meteringWithTrack = () => ({
  track: vi.fn().mockResolvedValue(undefined),
})

describe('Ingestion(polar.metering())', () => {
  it.each([
    [{ customerId: 'cus_1' }, { customer_id: 'cus_1' }],
    [{ customer_id: 'cus_1' }, { customer_id: 'cus_1' }],
    [{ externalCustomerId: 'ext_1' }, { external_customer_id: 'ext_1' }],
    [{ external_customer_id: 'ext_1' }, { external_customer_id: 'ext_1' }],
  ])('should track %o as %o', async (customer, expected) => {
    const metering = meteringWithTrack()
    const strategy = Ingestion(metering)
      .strategy(new DeltaTimeStrategy(() => 0))
      .ingest('elapsed')

    await strategy.execute({ deltaTime: 5, strategy: 'DeltaTime' }, customer)

    expect(metering.track).toHaveBeenCalledExactlyOnceWith({
      ...expected,
      name: 'elapsed',
      metadata: { deltaTime: 5, strategy: 'DeltaTime' },
    })
    expect(strategy.polarClient).toBeUndefined()
  })

  it('should snake-case the _llm metadata', async () => {
    const metering = meteringWithTrack()
    const strategy = Ingestion(metering)
      .strategy(new DeltaTimeStrategy(() => 0))
      .ingest('tokens')

    await strategy.execute(
      {
        deltaTime: 0,
        strategy: 'DeltaTime',
        _llm: {
          vendor: 'v',
          model: 'm',
          inputTokens: 10,
          cachedInputTokens: 0,
          outputTokens: 20,
          totalTokens: 30,
        },
      },
      { customerId: 'cus_1' },
    )

    expect(metering.track.mock.calls[0][0].metadata._llm).toEqual({
      vendor: 'v',
      model: 'm',
      input_tokens: 10,
      cached_input_tokens: 0,
      output_tokens: 20,
      total_tokens: 30,
    })
  })

  it('should pass ingest() events to track() as given', async () => {
    const metering = meteringWithTrack()
    const event = { name: 'raw', external_customer_id: 'ext_1' }

    await Ingestion(metering).ingest([event, event])

    expect(metering.track).toHaveBeenCalledTimes(2)
    expect(metering.track).toHaveBeenCalledWith(event)
  })
})

describe('Ingestion({ accessToken })', () => {
  it('should send a 0.4 config to its server in snake_case', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ inserted: 1, duplicates: 0 }))
    const strategy = Ingestion({
      accessToken: 'polar_oat_test',
      serverURL: 'http://polar.test',
    })
      .strategy(new DeltaTimeStrategy(() => 0))
      .ingest('elapsed')

    await strategy.execute(
      { deltaTime: 5, strategy: 'DeltaTime' },
      { externalCustomerId: 'ext_1' },
    )

    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe('http://polar.test/v1/events/ingest')
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer polar_oat_test',
    )
    expect(JSON.parse(String(init?.body))).toEqual({
      events: [
        {
          external_customer_id: 'ext_1',
          name: 'elapsed',
          metadata: { deltaTime: 5, strategy: 'DeltaTime' },
        },
      ],
    })
    fetch.mockRestore()
  })
})
