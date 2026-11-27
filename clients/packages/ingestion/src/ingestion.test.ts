import type { EventInput } from '@polar-sh/sdk/metering'
import { describe, expect, it, vi } from 'vitest'

import { Ingestion } from './ingestion'
import { DeltaTimeStrategy } from './strategies/DeltaTime'

describe('Ingestion(polar)', () => {
  it.each([
    [{ customerId: 'cus_1' }, { customer_id: 'cus_1' }],
    [{ customer_id: 'cus_1' }, { customer_id: 'cus_1' }],
    [{ externalCustomerId: 'ext_1' }, { external_customer_id: 'ext_1' }],
    [{ external_customer_id: 'ext_1' }, { external_customer_id: 'ext_1' }],
  ])('should track %o as %o', async (customer, expected) => {
    const track = vi
      .fn<(event: EventInput) => Promise<void>>()
      .mockResolvedValue()
    const strategy = Ingestion({ track })
      .strategy(new DeltaTimeStrategy(() => 0))
      .ingest('elapsed')

    await strategy.execute({ deltaTime: 5, strategy: 'DeltaTime' }, customer)

    expect(track).toHaveBeenCalledExactlyOnceWith({
      ...expected,
      name: 'elapsed',
      metadata: { deltaTime: 5, strategy: 'DeltaTime' },
    })
    expect(strategy.polarClient).toBeUndefined()
  })

  it('should snake-case the _llm metadata', async () => {
    const track = vi
      .fn<(event: EventInput) => Promise<void>>()
      .mockResolvedValue()
    const strategy = Ingestion({ track })
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

    expect(track.mock.calls[0]?.[0].metadata?._llm).toEqual({
      vendor: 'v',
      model: 'm',
      input_tokens: 10,
      cached_input_tokens: 0,
      output_tokens: 20,
      total_tokens: 30,
    })
  })

  it('should pass ingest() events to track() as given', async () => {
    const track = vi
      .fn<(event: EventInput) => Promise<void>>()
      .mockResolvedValue()
    const event = { name: 'raw', external_customer_id: 'ext_1' }

    await Ingestion({ track }).ingest([event, event])

    expect(track).toHaveBeenCalledTimes(2)
    expect(track).toHaveBeenCalledWith(event)
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

  it('should send 0.4 camelCase ingest() events in snake_case', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ inserted: 2, duplicates: 0 }))

    await Ingestion({
      accessToken: 'polar_oat_test',
      serverURL: 'http://polar.test',
    }).ingest([
      {
        name: 'api_call',
        customerId: 'cus_1',
        memberId: 'mem_1',
        externalId: 'evt_1',
        parentId: 'evt_0',
        organizationId: 'org_1',
        metadata: { route: '/v1/x' },
      },
      { name: 'api_call', externalCustomerId: 'ext_1', externalMemberId: 'm' },
      { name: 'api_call', customer_id: 'cus_2' },
    ])

    const [, init] = fetch.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      events: [
        {
          name: 'api_call',
          customer_id: 'cus_1',
          member_id: 'mem_1',
          external_id: 'evt_1',
          parent_id: 'evt_0',
          organization_id: 'org_1',
          metadata: { route: '/v1/x' },
        },
        {
          name: 'api_call',
          external_customer_id: 'ext_1',
          external_member_id: 'm',
        },
        { name: 'api_call', customer_id: 'cus_2' },
      ],
    })
    fetch.mockRestore()
  })

  it('should fall back to POLAR_ACCESS_TOKEN like the 0.4 SDK', async () => {
    vi.stubEnv('POLAR_ACCESS_TOKEN', 'polar_oat_env')
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ inserted: 1, duplicates: 0 }))

    await Ingestion({ serverURL: 'http://polar.test' })
      .strategy(new DeltaTimeStrategy(() => 0))
      .ingest('elapsed')
      .execute(
        { deltaTime: 5, strategy: 'DeltaTime' },
        { externalCustomerId: 'ext_1' },
      )

    const [, init] = fetch.mock.calls[0]
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer polar_oat_env',
    )
    fetch.mockRestore()
    vi.unstubAllEnvs()
  })
})
