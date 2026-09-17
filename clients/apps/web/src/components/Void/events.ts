import { VoidEventRecord } from './identityLive'

export type VoidEventSource = 'user' | 'system'

export interface VoidCatalogEvent {
  id: string
  timestamp: string
  name: string
  source: VoidEventSource
  external_id: string
  external_identity_id: string | null
  external_root_id: string | null
  metadata: Record<string, unknown>
}

export interface VoidEventTypeStat {
  name: string
  source: VoidEventSource
  occurrences: number
}

const SPECS: [
  string,
  VoidEventSource,
  (index: number) => Record<string, unknown>,
][] = [
  [
    'llm.completion',
    'user',
    (index) => ({
      model: index % 3 === 0 ? 'gpt-4.1' : 'claude-sonnet',
      input_tokens: 400 + (index % 20) * 37,
      output_tokens: 80 + (index % 12) * 19,
    }),
  ],
  [
    'tool.call',
    'user',
    (index) => ({ tool: index % 2 === 0 ? 'search' : 'browser', ok: true }),
  ],
  [
    'subscription.renewed',
    'system',
    (index) => ({ product: index % 2 === 0 ? 'Scale' : 'Team' }),
  ],
  [
    'order.paid',
    'system',
    (index) => ({ amount: 2400 + (index % 8) * 100, currency: 'usd' }),
  ],
  [
    'meter.credited',
    'system',
    (index) => ({ meter: 'output_tokens', credits: 10_000 + index * 250 }),
  ],
  [
    'sandbox.started',
    'user',
    (index) => ({ image: index % 2 === 0 ? 'python:3.14' : 'node:24' }),
  ],
  [
    'sandbox.stopped',
    'user',
    (index) => ({ duration_s: 30 + (index % 15) * 12 }),
  ],
  [
    'meter.balance_low',
    'system',
    (index) => ({ meter: 'output_tokens', remaining: 800 + index * 20 }),
  ],
]

const ACTORS = [
  'ident_1',
  'ident_1_1',
  'ident_2',
  'ident_2_1',
  'ident_3',
  'ident_3_1',
  'ident_4',
  'ident_4_1',
  'ident_5',
  'ident_6',
]

const FIXTURE_END = Date.parse('2026-09-17T12:00:00.000Z')

const rootOf = (id: string) => {
  const parts = id.split('_')
  return parts.length > 2 ? `${parts[0]}_${parts[1]}` : id
}

export const FIXTURE_EVENTS: VoidCatalogEvent[] = Array.from(
  { length: 100 },
  (_, index) => {
    const [name, source, metadata] = SPECS[index % SPECS.length]
    const actor = ACTORS[index % ACTORS.length]
    return {
      id: `evt_${index + 1}`,
      timestamp: new Date(FIXTURE_END - index * 47 * 60_000).toISOString(),
      name,
      source,
      external_id: `ext_${index + 1}`,
      external_identity_id: actor,
      external_root_id: rootOf(actor),
      metadata: metadata(index),
    }
  },
)

export const toCatalogEvent = (event: VoidEventRecord): VoidCatalogEvent => ({
  id: event.id,
  timestamp: event.timestamp,
  name: event.name,
  source: event.source,
  external_id: event.external_id,
  external_identity_id: event.external_identity_id,
  external_root_id: event.external_root_id ?? null,
  metadata: event.metadata ?? {},
})

export const filterFixtureEvents = (
  events: VoidCatalogEvent[],
  filters: {
    name?: string | null
    identity?: string | null
    query?: string | null
    identityNames?: Map<string, string>
  },
) => {
  const name = filters.name?.trim()
  const identity = filters.identity?.trim()
  const query = filters.query?.trim().toLowerCase()
  return events.filter((event) => {
    if (name && event.name !== name) return false
    if (
      identity &&
      event.external_identity_id !== identity &&
      event.external_root_id !== identity
    ) {
      return false
    }
    if (!query) return true
    const identityName = event.external_identity_id
      ? (filters.identityNames?.get(event.external_identity_id) ??
        event.external_identity_id)
      : ''
    return [
      event.name,
      event.external_id,
      event.external_identity_id,
      event.external_root_id,
      identityName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
}

export const pageOf = <T>(items: T[], page: number, limit: number) =>
  items.slice((page - 1) * limit, page * limit)

export const eventTypeStats = (
  events: VoidCatalogEvent[],
): VoidEventTypeStat[] => {
  const counts = new Map<string, VoidEventTypeStat>()
  for (const event of events) {
    const current = counts.get(event.name)
    if (current) current.occurrences += 1
    else
      counts.set(event.name, {
        name: event.name,
        source: event.source,
        occurrences: 1,
      })
  }
  return [...counts.values()].toSorted((a, b) => a.name.localeCompare(b.name))
}

export const identityLabel = (id: string | null, names: Map<string, string>) =>
  id ? (names.get(id) ?? id) : '—'
