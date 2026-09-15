import type { PluginDef } from './plugin'
import {
  isDefinition,
  type Definition,
  type EntitlementDef,
  type EventDef,
  type LeafDefinition,
  type MeterDef,
  type ProductDef,
  type AnyReducer,
  type SignalRef,
} from './schema'
import type { EventStorage, EventStorageInput } from '../storage/storage'
import { sqliteEventStorage } from '../storage/sqlite'

/** A module of exports, of which the void definitions are kept. */
export type SchemaModule = Record<string, unknown>

export type EventsOf<M extends SchemaModule> = Extract<M[keyof M], EventDef>
export type MetersOf<M extends SchemaModule> = Extract<M[keyof M], MeterDef>

/** Deployable definitions; credentials select the organization outside config. */
export interface ConfigInput<M extends SchemaModule> {
  /** Lookup override using a published config hash. Omitted follows the organization default; null selects unversioned records. Does not affect publishing. */
  readonly versionId?: string | null
  readonly schema: M
  /**
   * Local ledgers that must persist every event before API ingestion, so this
   * client reads its own writes ahead of the server. Pass an `EventStorage`
   * adapter, or `{ type: 'sqlite', connection }` for the built-in one. Runtime-only.
   */
  readonly eventStorage?: readonly EventStorageInput[]
  /** Milliseconds between server baseline refreshes while signals are listened to. Runtime-only; defaults to 30 seconds. */
  readonly signalRefreshInterval?: number
  /**
   * How long event storage keeps an event the server has not yet confirmed,
   * in milliseconds. Confirmed events leave storage at the next check; this is
   * the backstop for the rest. Runtime-only; defaults to 7 days.
   */
  readonly eventRetention?: number
}

export interface Config<M extends SchemaModule = SchemaModule> {
  readonly versionId?: string | null
  readonly kind: 'config'
  readonly schema: M
  readonly events: readonly EventDef[]
  readonly reducers: readonly AnyReducer[]
  readonly meters: readonly MeterDef[]
  readonly entitlements: readonly EntitlementDef[]
  readonly products: readonly ProductDef[]
  readonly plugins: readonly PluginDef[]
  readonly signals: readonly SignalRef[]
  readonly eventStorage: readonly EventStorage[]
  readonly signalRefreshInterval?: number
  readonly eventRetention: number
}

export const DEFAULT_EVENT_RETENTION = 7 * 24 * 60 * 60 * 1000

/**
 * Plugin verbs sit beside the scope's own members, so a plugin export cannot
 * take one of their names. Mirrors `Scope` and `Queries`.
 */
const RESERVED_EXPORTS: ReadonlySet<string> = new Set([
  'id',
  'spawn',
  'setEntitlements',
  'tree',
  'parent',
  'root',
  'chain',
  'children',
  'customer',
  'snapshot',
  'run',
  'headers',
  'events',
  'reducers',
  'meters',
  'products',
  'entitlements',
  'subscriptions',
  'signals',
])

const unique = <T extends { key: string } | { name: string }>(
  label: string,
  items: readonly T[],
  id: (item: T) => string,
): T[] => {
  const seen = new Map<string, T>()
  for (const item of items) {
    const key = id(item)
    const prior = seen.get(key)
    if (prior && prior !== item)
      throw new Error(`${label} ${key} is defined twice`)
    seen.set(key, item)
  }
  return [...seen.values()]
}

/**
 * Walks the schema module and keeps every void definition, so a new export
 * is deployed without being listed a second time. Reducers under meters are
 * collected too, so a meter's inline reducer needs no export of its own.
 * A plugin's definitions are collected as if the plugin had exported them.
 */
export const defineConfig = <M extends SchemaModule>({
  schema,
  versionId,
  eventStorage = [],
  signalRefreshInterval,
  eventRetention = DEFAULT_EVENT_RETENTION,
}: ConfigInput<M>): Config<M> => {
  if (!(Number.isFinite(eventRetention) && eventRetention > 0))
    throw new Error('eventRetention must be a positive number of milliseconds')
  if (versionId != null && versionId.length === 0)
    throw new Error('versionId must not be empty')
  if (
    signalRefreshInterval !== undefined &&
    !(Number.isFinite(signalRefreshInterval) && signalRefreshInterval > 0)
  )
    throw new Error(
      'signalRefreshInterval must be a positive number of milliseconds',
    )
  const exported = Object.entries(schema).filter(
    (entry): entry is [string, Definition] => isDefinition(entry[1]),
  )
  // Two instances of one plugin may coexist; their slugs must differ, which
  // the checks below enforce like any other duplicate.
  const plugins = exported.flatMap(([exportName, definition]) => {
    if (definition.kind !== 'plugin') return []
    if (RESERVED_EXPORTS.has(exportName)) {
      throw new Error(
        `plugin ${definition.name} exported as ${exportName}: that name belongs to the scope; export it as something else`,
      )
    }
    return [definition]
  })
  const leaves: Array<[string, LeafDefinition]> = exported.flatMap(
    ([exportName, definition]) =>
      definition.kind === 'plugin'
        ? Object.entries(definition.schema).map(
            ([key, leaf]): [string, LeafDefinition] => [
              `${exportName}.${key}`,
              leaf,
            ],
          )
        : [[exportName, definition]],
  )
  const definitions = leaves.map(([exportName, definition]) => {
    if (definition.kind === 'reducer' && definition.key === undefined) {
      throw new Error(
        `reducer exported as ${exportName} has no key; give it one or declare it under a meter`,
      )
    }
    return definition
  })

  const signals = unique(
    'signal',
    definitions.filter((d): d is SignalRef => d.kind === 'signal'),
    (s) => s.key,
  )
  const products = unique(
    'product',
    definitions.filter((d): d is ProductDef => d.kind === 'product'),
    (p) => p.key,
  )
  // Meters and entitlements under products are collected too, like reducers under meters.
  const entitlements = unique(
    'entitlement',
    [
      ...definitions.filter(
        (d): d is EntitlementDef => d.kind === 'entitlement',
      ),
      ...products.flatMap((p) => p.entitlements),
    ],
    (e) => e.key,
  )
  const meters = unique(
    'meter',
    [
      ...definitions.filter((d): d is MeterDef => d.kind === 'meter'),
      ...products.flatMap((p) => p.meters.map((term) => term.meter)),
      ...signals.map((s) => s.definition.meter),
    ],
    (m) => m.key,
  )
  const declaredReducers = [
    ...definitions.filter((d): d is AnyReducer => d.kind === 'reducer'),
    ...meters.map((m) => m.reducer),
    ...meters.flatMap((m) => (m.creditReducer ? [m.creditReducer] : [])),
  ]
  const reducers = unique(
    'reducer',
    [
      ...declaredReducers,
      ...declaredReducers.flatMap((r) =>
        'inputs' in r ? Object.values(r.inputs) : [],
      ),
    ],
    (r) => r.key,
  )
  const events = unique(
    'event',
    [
      ...definitions.filter((d): d is EventDef => d.kind === 'event'),
      ...reducers.flatMap((r) => ('inputs' in r ? [] : [r.filter.event])),
    ],
    (e) => e.name,
  )
  return {
    kind: 'config',
    ...(versionId !== undefined && { versionId }),
    schema,
    events,
    reducers,
    meters,
    entitlements,
    products,
    plugins,
    signals,
    eventStorage: eventStorage.map((input) =>
      'persist' in input ? input : sqliteEventStorage(input.connection),
    ),
    ...(signalRefreshInterval !== undefined && { signalRefreshInterval }),
    eventRetention,
  }
}
