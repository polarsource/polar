import type { Queries } from '../runtime/queries'
import type { SnapshotMeters } from '../runtime/snapshot'
import type { LeafDefinition, Metadata } from './schema'

/** The definitions a plugin contributes. Plugins do not nest. */
export type PluginSchema = Record<string, LeafDefinition>

export interface PluginContext {
  /** The identity the verbs act as. */
  readonly id: string
}

/** What a plugin sees of the client it is attached to. */
export interface PluginClient {
  readonly config: { readonly schema: Record<string, unknown> }
  /** The ambient identity and its tags, or undefined outside any `run`. */
  ambient(): { readonly id: string; readonly tags: Metadata } | undefined
  as(id: string): unknown
}

/**
 * A billing concept with verbs: the definitions it needs, deployed as if
 * exported themselves, and the verbs built over the queries for them. Verbs
 * can do nothing a caller could not do by hand against the same queries.
 */
export interface PluginDef<
  Name extends string = string,
  S extends PluginSchema = PluginSchema,
  Verbs = unknown,
  Snapshot = unknown,
> {
  readonly kind: 'plugin'
  readonly name: Name
  readonly schema: S
  // Methods, so a plugin over a specific schema still matches the bare PluginDef.
  runtime(queries: Queries<S>, context: PluginContext): Verbs
  /** How the plugin's meter balances appear under its export name in `snapshot()`. */
  snapshot(meters: SnapshotMeters<S>): Snapshot
  /**
   * Called by `createVoid` for every plugin in the config, for process-wide
   * wiring the plugin needs beyond per-identity verbs. Returns the cleanup
   * `dispose` runs, if any.
   */
  attach?(client: PluginClient): void | (() => void)
}

/** A type-only declaration of extra metadata a plugin's events carry; nothing is emitted. */
export const tags = <Extra extends Metadata>(): Extra => ({}) as Extra

export type VerbsOf<P extends PluginDef> =
  P extends PluginDef<string, PluginSchema, infer Verbs, unknown>
    ? Verbs
    : never
export type SnapshotOf<P extends PluginDef> =
  P extends PluginDef<string, PluginSchema, unknown, infer Snapshot>
    ? Snapshot
    : never

const OWN_FIELDS: ReadonlySet<string> = new Set([
  'kind',
  'name',
  'schema',
  'runtime',
  'snapshot',
  'attach',
])

/**
 * The plugin's definitions are also its properties, so products and custom
 * reducers reach them as `wallet.credits` rather than `wallet.schema.credits`.
 */
export function plugin<
  Name extends string,
  S extends PluginSchema,
  Verbs,
  Snapshot = SnapshotMeters<S>,
>(
  name: Name,
  options: {
    schema: S
    runtime: (queries: Queries<S>, context: PluginContext) => Verbs
    /** Defaults to the plugin's meter balances keyed as in its schema. */
    snapshot?: (meters: SnapshotMeters<S>) => Snapshot
    /** Process-wide wiring when a client is created; returns the cleanup for `dispose`. */
    attach?: (client: PluginClient) => void | (() => void)
  },
): PluginDef<Name, S, Verbs, Snapshot> & S {
  if (name === '') throw new Error('plugin: empty name')
  for (const key of Object.keys(options.schema)) {
    if (OWN_FIELDS.has(key))
      throw new Error(
        `plugin ${name}: schema key ${key} collides with the plugin's own fields`,
      )
  }
  const snapshot =
    options.snapshot ??
    ((meters: SnapshotMeters<S>) => meters as unknown as Snapshot)
  return {
    ...options.schema,
    kind: 'plugin',
    name,
    schema: options.schema,
    runtime: options.runtime,
    snapshot,
    ...(options.attach && { attach: options.attach }),
  }
}
