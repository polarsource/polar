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

  test('gives an external ID that is not a Python name an attribute of its own', async () => {
    const source = await Effect.runPromise(
      renderPython({
        meters: [
          'tool-call',
          'class',
          '__tool_call',
          'tool_call',
          '9lives',
        ].map((external_id) => ({ ...toolCall, external_id })),
      }),
    )

    expect(source).toContain(`class Meters(MeterSet):
    tool_call_2 = Meter("Tool calls", on="tool_call", external_id="tool-call")
    meter_class = Meter("Tool calls", on="tool_call", external_id="class")
    tool_call_3 = Meter("Tool calls", on="tool_call", external_id="__tool_call")
    tool_call = Meter("Tool calls", on="tool_call")
    meter_9lives = Meter("Tool calls", on="tool_call", external_id="9lives")
`)
  })

  test('keeps attributes from hiding the helpers the file calls or being renamed by Python', async () => {
    const source = await Effect.runPromise(
      renderPython({
        meters: ['Meter', 'eq', 'Sum', '_Meters__calls', '_private'].map(
          (external_id) => ({ ...toolCall, external_id }),
        ),
      }),
    )

    expect(source).toContain(`class Meters(MeterSet):
    meter_Meter = Meter("Tool calls", on="tool_call", external_id="Meter")
    meter_eq = Meter("Tool calls", on="tool_call", external_id="eq")
    meter_Sum = Meter("Tool calls", on="tool_call", external_id="Sum")
    Meters__calls = Meter("Tool calls", on="tool_call", external_id="_Meters__calls")
    private = Meter("Tool calls", on="tool_call", external_id="_private")
`)
  })

  const ok = { property: 'ok', operator: 'eq', value: true }
  const either = {
    conjunction: 'or',
    clauses: [event('call'), event('chat')],
  }

  test.each([
    ['several events', either, 'on=["call", "chat"]'],
    [
      'several events with a condition',
      { conjunction: 'and', clauses: [either, ok] },
      'on=["call", "chat"], where=eq("ok", True)',
    ],
    [
      'several events alone in a group, which on= would unwrap',
      { conjunction: 'and', clauses: [either] },
      'where=and_(or_(eq("name", "call"), eq("name", "chat")))',
    ],
    [
      'the filter the dashboard gives a meter',
      {
        conjunction: 'and',
        clauses: [{ conjunction: 'or', clauses: [event('call')] }],
      },
      'where=and_(or_(eq("name", "call")))',
    ],
    [
      'conditions Python would merge into the event filter',
      {
        conjunction: 'and',
        clauses: [event('call'), { conjunction: 'and', clauses: [ok] }],
      },
      'where=and_(eq("name", "call"), and_(eq("ok", True)))',
    ],
    [
      'one condition and no event',
      { conjunction: 'and', clauses: [ok] },
      'where=eq("ok", True)',
    ],
    ['no filter', { conjunction: 'and', clauses: [] }, undefined],
  ])('writes a meter with %s', async (_, filter, expected) => {
    const source = await Effect.runPromise(
      renderPython({ meters: [{ ...toolCall, name: 'Calls', filter }] }),
    )

    expect(source).toContain(
      `    tool_call = Meter(${['"Calls"', expected].filter(Boolean).join(', ')})\n`,
    )
  })
})
