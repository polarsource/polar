import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { renderPython } from '@/services/billing-config/languages/python/render'

const event = (name: string) => ({
  property: 'name',
  operator: 'eq',
  value: name,
})

const toolCall = {
  external_id: 'tool_call',
  name: 'Tool calls',
  unit: 'scalar',
  custom_label: null,
  custom_multiplier: null,
  filter: { conjunction: 'and', clauses: [event('tool_call')] },
  aggregation: { func: 'count' },
  metadata: {},
}

describe('renderPython', () => {
  test('writes meters the way ruff formats them', async () => {
    const source = await Effect.runPromise(
      renderPython({
        meters: [
          toolCall,
          {
            ...toolCall,
            external_id: 'tokens',
            name: 'Output tokens',
            unit: 'token',
            filter: {
              conjunction: 'and',
              clauses: [
                event('llm.completion'),
                { property: 'status', operator: 'eq', value: 'ok' },
              ],
            },
            aggregation: { func: 'sum', property: 'output_tokens' },
          },
          {
            ...toolCall,
            external_id: 'slow_requests',
            name: 'Slow "requests" \\ day',
            unit: 'custom',
            custom_label: 'requests',
            custom_multiplier: 1000,
            filter: {
              conjunction: 'and',
              clauses: [
                event('request'),
                { property: 'duration', operator: 'gt', value: 500 },
                {
                  conjunction: 'or',
                  clauses: [
                    { property: 'status', operator: 'eq', value: 'error' },
                    {
                      property: 'path',
                      operator: 'not_like',
                      value: '/health%',
                    },
                    { property: 'cached', operator: 'ne', value: true },
                  ],
                },
              ],
            },
            aggregation: { func: 'unique', property: 'user_id' },
            metadata: { team: 'core', tier: 2, ratio: 0.5, beta: true },
          },
        ],
      }),
    )

    expect(source).toBe(`from polar.config import (
    Config,
    Meter,
    MeterSet,
    Sum,
    Unique,
    and_,
    eq,
    gt,
    ne,
    not_like,
    or_,
)


class Meters(MeterSet):
    tool_call = Meter("Tool calls", on="tool_call")
    tokens = Meter(
        "Output tokens",
        on="llm.completion",
        where=eq("status", "ok"),
        aggregate=Sum("output_tokens"),
        unit="token",
    )
    slow_requests = Meter(
        'Slow "requests" \\\\ day',
        on="request",
        where=and_(
            gt("duration", 500),
            or_(
                eq("status", "error"),
                not_like("path", "/health%"),
                ne("cached", True),
            ),
        ),
        aggregate=Unique("user_id"),
        unit="custom",
        custom_label="requests",
        custom_multiplier=1000,
        metadata={"team": "core", "tier": 2, "ratio": 0.5, "beta": True},
    )


config = Config(meters=Meters)
`)
  })

  test('writes an empty set for an organization without meters', async () => {
    expect(await Effect.runPromise(renderPython({ meters: [] })))
      .toBe(`from polar.config import Config, MeterSet


class Meters(MeterSet):
    pass


config = Config(meters=Meters)
`)
  })

  test.each([
    ['an external ID with a dash', { ...toolCall, external_id: 'tool-call' }],
    ['a Python keyword as external ID', { ...toolCall, external_id: 'class' }],
    [
      'an external ID Python would mangle inside a class',
      { ...toolCall, external_id: '__tool_call' },
    ],
    [
      'several events',
      {
        ...toolCall,
        filter: {
          conjunction: 'or',
          clauses: [event('tool_call'), event('llm_call')],
        },
      },
    ],
    [
      'conditions Python would merge into the event filter',
      {
        ...toolCall,
        filter: {
          conjunction: 'and',
          clauses: [
            event('tool_call'),
            {
              conjunction: 'and',
              clauses: [{ property: 'ok', operator: 'eq', value: true }],
            },
          ],
        },
      },
    ],
  ])('refuses a meter with %s', async (_, meter) => {
    const error = await Effect.runPromise(
      Effect.flip(renderPython({ meters: [meter] })),
    )

    expect(error.message).toBe(
      `The meter ${meter.external_id} has an external ID or a filter that Python cannot express yet.`,
    )
  })
})
