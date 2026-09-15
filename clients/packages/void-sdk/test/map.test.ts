import { readFileSync } from 'node:fs'
import { expect, it } from '@effect/vitest'
import {
  compile,
  defineConfig,
  event,
  first,
  last,
  map,
  on,
  sum,
} from '../src/config/index'
import type { Metadata } from '../src/config/schema'
import { mapMetadata } from '../src/config/map'
import { contribution, matches, merge } from '../src/storage/reducers'
import type { Reducer } from '../src/api/generated'
import type { StoredEvent } from '../src/storage/storage'
import type { RecordData } from '../src/runtime/queries'

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/reducer_map.json', import.meta.url), 'utf8'),
) as {
  cases: {
    name: string
    map: Metadata | null
    metadata: Metadata
    expected: Metadata
  }[]
  invalid: string[]
}

for (const example of fixture.cases) {
  it(`maps metadata consistently with ClickHouse: ${example.name}`, () => {
    expect(mapMetadata(example.map, example.metadata)).toEqual(example.expected)
  })
}
for (const expression of fixture.invalid) {
  it(`rejects invalid map expression: ${expression}`, () => {
    expect(() => map(event('usage'), { result: expression })).toThrow(
      'Invalid map expression',
    )
  })
}

const usage = event<{ asdf: number; label: string; status: string }>('usage')
const mapped = map(on(usage, { status: 'ok' }), {
  amount: '$asdf + 20',
  title: '$label',
  original: '$asdf',
})
const total = sum('total', mapped, 'amount')
const record = last('record', mapped)

// oxlint-disable-next-line no-constant-condition -- Compile-time assertions must not execute.
if (false) {
  const _result: RecordData<typeof record> = {
    amount: 30,
    title: 'hello',
    original: null,
  }
  // @ts-expect-error projected string fields cannot be summed
  sum(mapped, 'title')
  // @ts-expect-error omitted source keys are absent from projected metadata
  sum(mapped, 'asdf')
  const _wrong: RecordData<typeof record> = {
    // @ts-expect-error projected arithmetic yields numbers
    amount: '30',
    title: 'hello',
    original: 10,
  }
}

it('compiles the projection and original filter for named and inline reducers', () => {
  const config = defineConfig({
    schema: { usage, total, record, first: first('first', mapped) },
  })
  const compiled = compile(config)
  expect(compiled.reducers.find((r) => r.slug === 'total')).toEqual({
    slug: 'total',
    filter: {
      conjunction: 'and',
      clauses: [
        { property: 'name', operator: 'eq', value: 'usage' },
        { property: 'status', operator: 'eq', value: 'ok' },
      ],
    },
    map: { amount: '$asdf + 20', title: '$label', original: '$asdf' },
    aggregation: { func: 'sum', property: 'amount' },
  })
  expect(sum(mapped, 'amount').map).toEqual(total.map)
  expect(sum('plain', usage, 'asdf').map).toBeUndefined()
  expect(first('empty', map(usage, {})).map).toEqual({})
})

it('filters source metadata and contributes the mapped numeric result', () => {
  const reducer: Reducer = {
    filter: null,
    map: null,
    ...compile(defineConfig({ schema: { usage, total } })).reducers[0]!,
    id: 'r1',
    created_at: '2026-09-08T00:00:00Z',
    type: 'scalar',
  }
  const stored: StoredEvent = {
    organization_id: 'org',
    recorded_at: '2026-09-08T12:00:00Z',
    external_id: 'e1',
    external_identity_id: 'actor',
    name: 'usage',
    timestamp: '2026-09-08T12:00:00Z',
    metadata: { asdf: 10, label: 'hello', status: 'ok' },
  }
  expect(matches(reducer.filter, stored, 'root')).toBe(true)
  expect(contribution(reducer, stored)).toBe(30)
  expect(contribution({ ...reducer, map: {} }, stored)).toBeNull()
  expect(
    contribution({ ...reducer, map: { amount: '$asdf / 0' } }, stored),
  ).toBeNull()
})

it('rejects nonfinite JSON literals', () => {
  for (const value of [NaN, Infinity, -Infinity])
    expect(() => map(usage, { nested: { value } })).toThrow(
      'finite JSON numbers',
    )
})

const doubleThenSumExamples: {
  name: string
  events: Metadata[]
  filterValue?: number
  expected: number
}[] = [
  {
    name: '10, 20, 30 → 20 + 40 + 60 = 120',
    events: [{ asdf: 10 }, { asdf: 20 }, { asdf: 30 }],
    expected: 120,
  },
  {
    name: '-2, 0, 1.5 → -4 + 0 + 3 = -1',
    events: [{ asdf: -2 }, { asdf: 0 }, { asdf: 1.5 }],
    expected: -1,
  },
  {
    name: 'filter asdf = 10 first → 20 + 20 = 40',
    events: [{ asdf: 10 }, { asdf: 20 }, { asdf: 10 }],
    filterValue: 10,
    expected: 40,
  },
  {
    name: 'skip missing, string, and null values → 20',
    events: [{ asdf: 10 }, {}, { asdf: '20' }, { asdf: null }],
    expected: 20,
  },
]

it.each(doubleThenSumExamples)(
  'map * 2 then sum: $name',
  ({ events, filterValue, expected }) => {
    const reading = event<{ asdf: number }>('reading')
    const source =
      filterValue === undefined ? reading : on(reading, { asdf: filterValue })
    const doubled = map(source, { amount: '$asdf * 2' })
    const total = sum('doubled-total', doubled, 'amount')
    const reducer: Reducer = {
      filter: null,
      map: null,
      ...compile(defineConfig({ schema: { reading, total } })).reducers[0]!,
      id: 'double',
      created_at: '2026-09-08T00:00:00Z',
      type: 'scalar',
    }
    const stored: StoredEvent[] = events.map((metadata, index) => ({
      organization_id: 'org',
      external_id: `e${index}`,
      external_identity_id: 'actor',
      name: 'reading',
      timestamp: '2026-09-08T12:00:00Z',
      recorded_at: '2026-09-08T12:00:00Z',
      metadata,
    }))
    const values = stored
      .filter((event) => matches(reducer.filter, event, 'actor'))
      .map((event) => contribution(reducer, event))
      .filter((value): value is number => value !== null)
    expect(merge('sum', values)).toBe(expected)
  },
)
