import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'
import {
  Api,
  type Customer,
  type EntitlementAssignmentRead,
  type IdentityDetail,
} from '../api/index'
import type { RunEffect } from '../api/layers'
import { compile } from '../config/compile'
import type { Config, SchemaModule } from '../config/config'
import type { Metadata, EntitlementDef, MeterDef } from '../config/schema'
import { VoidError } from '../errors'
import { IDENTITY_HEADER, type IdentityContext } from './context'
import type { Queries } from './queries'
import type { IdentitySnapshot } from './snapshot'

export type { Metadata } from '../config/schema'

/** Replacement terms. Omitted lists inherit; empty lists deny access. */
export interface IdentityEntitlements {
  readonly features?: readonly EntitlementDef[] | null
  readonly meters?:
    | readonly { readonly meter: MeterDef; readonly cap?: number | null }[]
    | null
}

export interface SpawnOptions {
  readonly metadata?: Metadata
  /** Terms the child starts with, as `setEntitlements` would record them. */
  readonly entitlements?: IdentityEntitlements
}
export interface EnsureOptions {
  readonly parent?: string
  readonly metadata?: Metadata
}

const mintKey = (parent: string) => `${parent}:${randomUUID().slice(0, 8)}`

/** Queries, plugin verbs and navigation for one identity. */
export type Scope<M extends SchemaModule = SchemaModule> = Queries<M> &
  Navigation<M>

/** The scope's own members, which plugin exports may not shadow. */
export interface Navigation<M extends SchemaModule = SchemaModule> {
  readonly id: string
  spawn(id?: string, options?: SpawnOptions): Promise<Scope<M>>
  /** Record replacement entitlements. Effective after reducer processing. */
  setEntitlements(
    entitlements: IdentityEntitlements,
    options?: { readonly id?: string },
  ): Promise<void>
  /**
   * Cap one meter for this identity, in the meter's units, keeping every
   * other term as it is; null lifts the cap. An identity that still inherits
   * every meter is first given the config's full meter list, so capping one
   * denies none of the others. Like `deny` and `allow`, this edits the terms
   * as the server has processed them so far, so give a previous edit a moment
   * before making the next.
   */
  cap(meter: MeterDef, cap: number | null): Promise<void>
  /** Give one feature back, keeping other terms. Nothing to do while every feature is inherited. */
  allow(feature: EntitlementDef): Promise<void>
  /**
   * Take one feature away, keeping other terms. An identity that still
   * inherits every feature is first given the config's full feature list.
   */
  deny(feature: EntitlementDef): Promise<void>
  tree(): Promise<IdentityDetail>
  parent(): Promise<Scope<M> | null>
  root(): Promise<Scope<M>>
  chain(): Promise<ReadonlyArray<string>>
  children(): Promise<ReadonlyArray<Scope<M>>>
  customer(): Promise<Customer | null>
  /** One server-produced view of this identity and its current billing state. */
  snapshot(): Promise<IdentitySnapshot<M>>
  /**
   * Run `fn` with this identity as the ambient actor. Tags ride along and
   * land on whatever captured calls record meanwhile.
   */
  run<T>(fn: () => Promise<T> | T, tags?: Metadata): Promise<T>
  /** Headers that carry this identity across a process boundary. */
  headers(): Record<string, string>
}

/** Identity lifecycle and navigation, with queries attached by the client. */
export function makeScopes<M extends SchemaModule>(
  config: Config<M>,
  queries: (id: string) => Queries<M>,
  snapshot: (id: string) => Promise<IdentitySnapshot<M>>,
  context: IdentityContext,
  run: RunEffect<Api>,
) {
  const ensure = Effect.fn('Scope.ensure')(function* (
    id: string,
    { parent, metadata }: EnsureOptions,
  ) {
    const api = yield* Api
    const identity = yield* api.identitiesEnsure({
      payload: {
        external_id: id,
        parent_external_id: parent ?? null,
        ...(metadata && { metadata }),
      },
    })
    const name = (p: string | null) => p ?? 'no parent'
    if ((parent ?? null) !== identity.parent_external_id) {
      return yield* new VoidError({
        reason: 'parent_mismatch',
        message: `identity ${id} already exists under ${name(identity.parent_external_id)}, not ${name(parent ?? null)}; a parent is set on first touch and never changes`,
      })
    }
  })

  // What "inherit everything" spells out to, for the verbs that edit one term.
  const ir = compile(config)
  const everyMeter = () =>
    ir.meters.map(({ slug }) => ({ meter: slug, cap: null }))
  const everyFeature = () => ir.entitlements.map(({ slug }) => slug)

  const toWire = (
    entitlements: IdentityEntitlements,
  ): EntitlementAssignmentRead => ({
    features: entitlements.features?.map((feature) => feature.key) ?? null,
    meters:
      entitlements.meters?.map(({ meter, cap }) => ({
        meter: meter.key,
        cap: cap ?? null,
      })) ?? null,
  })

  /** Replace the identity's terms. */
  const assign = Effect.fn('Scope.assign')(function* (
    id: string,
    terms: EntitlementAssignmentRead,
    external = randomUUID(),
  ) {
    const api = yield* Api
    yield* api.identitiesAssignEntitlements(id, {
      payload: {
        external_id: external,
        features: terms.features ?? null,
        meters: terms.meters ?? null,
      },
    })
  })

  /** The identity's own terms as recorded; both lists null when it inherits. */
  const assignment = Effect.fn('Scope.assignment')(function* (id: string) {
    const api = yield* Api
    const held = yield* api.identitiesEntitlements(id, undefined)
    return held.assignments?.[id] ?? {}
  })

  const scope = (id: string): Scope<M> => {
    const tree = Effect.fn('Scope.tree')(function* () {
      const api = yield* Api
      return yield* api.identitiesGet(id, undefined)
    })
    return {
      id,
      ...queries(id),
      setEntitlements: (entitlements, options = {}) =>
        run(assign(id, toWire(entitlements), options.id)),
      cap: (meter, cap) =>
        run(
          Effect.gen(function* () {
            const current = yield* assignment(id)
            const others = (current.meters ?? everyMeter()).filter(
              (entry) => entry.meter !== meter.key,
            )
            yield* assign(id, {
              features: current.features ?? null,
              meters: [...others, { meter: meter.key, cap }],
            })
          }),
        ),
      allow: (feature) =>
        run(
          Effect.gen(function* () {
            const current = yield* assignment(id)
            if (
              current.features == null ||
              current.features.includes(feature.key)
            )
              return
            yield* assign(id, {
              features: [...current.features, feature.key],
              meters: current.meters ?? null,
            })
          }),
        ),
      deny: (feature) =>
        run(
          Effect.gen(function* () {
            const current = yield* assignment(id)
            yield* assign(id, {
              features: (current.features ?? everyFeature()).filter(
                (slug) => slug !== feature.key,
              ),
              meters: current.meters ?? null,
            })
          }),
        ),
      tree: () => run(tree()),
      chain: () => run(Effect.map(tree(), (detail) => detail.chain)),
      customer: () =>
        run(
          Effect.gen(function* () {
            const api = yield* Api
            const { chain } = yield* tree()
            return yield* api
              .customersGet(chain[chain.length - 1] ?? id, undefined)
              .pipe(
                Effect.catchIf(
                  (error) => error._tag === 'VoidHttpError' && error.notFound,
                  () => Effect.succeed(null),
                ),
              )
          }),
        ),
      snapshot: () => snapshot(id),
      spawn: (childId = mintKey(id), { metadata, entitlements } = {}) =>
        run(
          Effect.gen(function* () {
            yield* ensure(childId, { parent: id, metadata })
            if (entitlements) yield* assign(childId, toWire(entitlements))
            return scope(childId)
          }),
        ),
      parent: () =>
        run(
          Effect.map(tree(), ({ parent_external_id }) =>
            parent_external_id === null ? null : scope(parent_external_id),
          ),
        ),
      root: () =>
        run(
          Effect.map(tree(), ({ chain }) =>
            scope(chain[chain.length - 1] ?? id),
          ),
        ),
      children: () =>
        run(
          Effect.map(tree(), (detail) =>
            detail.children.map((child) => scope(child.external_id)),
          ),
        ),
      run: (fn, tags) => context.run(id, fn, tags),
      headers: () => ({ [IDENTITY_HEADER]: id }),
    }
  }

  return {
    as: scope,
    ensure: async (
      id: string,
      { parent = context.get(), metadata }: EnsureOptions = {},
    ) => {
      if (parent === undefined) {
        throw new VoidError({
          reason: 'no_scope',
          message: `ensure(${id}): no parent given and none in scope; use client.root() to create a root on purpose`,
        })
      }
      await run(ensure(id, { parent, metadata }))
      return scope(id)
    },
    root: async (id: string, { metadata }: { metadata?: Metadata } = {}) => {
      await run(ensure(id, { metadata }))
      return scope(id)
    },
  }
}
