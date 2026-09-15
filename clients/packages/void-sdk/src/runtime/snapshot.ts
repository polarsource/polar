import { Effect } from 'effect'
import {
  Api,
  type Balance,
  type IdentitySnapshot as WireIdentitySnapshot,
} from '../api/index'
import type { RunEffect } from '../api/layers'
import type { Config, SchemaModule } from '../config/config'
import type { PluginDef, SnapshotOf } from '../config/plugin'
import { isDefinition, type MeterDef } from '../config/schema'
import { VoidError } from '../errors'

// An interface, not an alias: consumers name it through `@void/sdk`, where a
// bare alias would resolve to the unexported generated `Balance`.
// oxlint-disable-next-line typescript/no-empty-object-type
export interface MeterSnapshot extends Balance {}

/** Meter balances by export name; a plugin appears as its own snapshot shape. */
export type SnapshotMeters<M extends SchemaModule> = {
  readonly [K in keyof M as M[K] extends MeterDef | PluginDef
    ? K
    : never]: M[K] extends PluginDef ? SnapshotOf<M[K]> : MeterSnapshot
}

export type IdentitySnapshot<M extends SchemaModule = SchemaModule> = Omit<
  WireIdentitySnapshot,
  'meters'
> & {
  readonly meters: SnapshotMeters<M>
}

type BoundSnapshot = Omit<WireIdentitySnapshot, 'meters'> & {
  readonly meters: Readonly<Record<string, unknown>>
}

function bindSnapshot<M extends SchemaModule>(
  config: Config<M>,
  snapshot: WireIdentitySnapshot,
): Effect.Effect<IdentitySnapshot<M>, VoidError>
function bindSnapshot(
  config: Config<SchemaModule>,
  snapshot: WireIdentitySnapshot,
): Effect.Effect<BoundSnapshot, VoidError> {
  return Effect.gen(function* () {
    const balanceOf = (meter: MeterDef) =>
      Effect.gen(function* () {
        const balance = snapshot.meters[meter.key]
        if (balance === undefined) {
          return yield* new VoidError({
            reason: 'not_deployed',
            message: `meter ${meter.key} is not deployed; run \`void deploy\``,
          })
        }
        return balance
      })
    // Mirrors SnapshotMeters<M>: meters by export name, plugins by their own shape.
    const walk = (
      schema: SchemaModule,
    ): Effect.Effect<Record<string, unknown>, VoidError> =>
      Effect.gen(function* () {
        const meters: Record<string, unknown> = {}
        for (const [name, definition] of Object.entries(schema)) {
          if (!isDefinition(definition)) continue
          if (definition.kind === 'meter') {
            meters[name] = yield* balanceOf(definition)
          } else if (definition.kind === 'plugin') {
            const own = yield* walk(definition.schema)
            meters[name] = definition.snapshot(own)
          }
        }
        return meters
      })
    return { ...snapshot, meters: yield* walk(config.schema) }
  })
}

/** Bind a server-produced identity snapshot to the config's exported names. */
export function makeSnapshots<M extends SchemaModule>(
  config: Config<M>,
  run: RunEffect<Api>,
): (id: string) => Promise<IdentitySnapshot<M>> {
  const snapshot = Effect.fn('Scope.snapshot')(function* (id: string) {
    const api = yield* Api
    return yield* bindSnapshot(
      config,
      yield* api.identitiesSnapshot(id, undefined),
    )
  })
  return (id) => run(snapshot(id))
}
