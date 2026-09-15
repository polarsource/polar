import { plugin, type PluginDef } from '../config/plugin'
import {
  event,
  meter,
  sum,
  type EventDef,
  type MetadataOf,
  type Metadata,
  type MeterDef,
  type Price,
  type ReducerDef,
} from '../config/schema'
import type { CheckResult, MeterQuery, RecordOptions } from '../runtime/queries'
import type { MeterSnapshot } from '../runtime/snapshot'

type SumReducer = ReducerDef<
  string,
  EventDef,
  { func: 'sum'; property: string }
>

export interface CreditsOptions<
  Spent extends SumReducer | undefined,
  Grants extends SumReducer | undefined,
  Extra extends Metadata,
> {
  /** The meter slug and event namespace. Defaults to `credits`. */
  readonly key?: string
  /** Per credit past the allowance. `usd(0)` for prepaid-only pools. */
  readonly price: Price
  /**
   * An existing sum reducer to adopt as the spend side, so a live ledger keeps
   * its history. Otherwise the plugin records its own `<key>.spent` event.
   */
  readonly spent?: Spent
  /**
   * An existing sum reducer supplying credits, such as one over a purchase
   * event the app already records. Otherwise the plugin owns `<key>.granted`
   * and offers `grant`.
   */
  readonly grants?: Grants
  /** Type-only: extra metadata on the plugin's own events, as `tags<{ reason: string }>()`. */
  readonly tags?: Extra
}

type Own<Extra extends Metadata> = EventDef<{ amount: number } & Extra>
type SpentEvent<Spent, Extra extends Metadata> =
  Spent extends ReducerDef<string, infer E, { func: 'sum'; property: string }>
    ? E
    : Own<Extra>
type AmountKey<Spent> =
  Spent extends ReducerDef<
    string,
    EventDef,
    { func: 'sum'; property: infer P extends string }
  >
    ? P
    : 'amount'
/** What a spend carries besides the amount: the adopted event's other fields, or the tags. */
export type SpendMetadata<Spent, Extra extends Metadata> =
  Spent extends ReducerDef<string, infer E, { func: 'sum'; property: string }>
    ? Omit<MetadataOf<E>, AmountKey<Spent> & string>
    : Extra

/** The result of `charge`: either the work ran and was spent, or the check denied it. */
export type Charge<T> =
  | {
      readonly charged: true
      readonly amount: number
      readonly result: T
      readonly check: CheckResult
    }
  | { readonly charged: false; readonly check: CheckResult }

/** What `settle` returns: the spend metadata plus, optionally, the actual amount. */
export type Settlement<Meta> = Meta & { readonly amount?: number }

export interface GrantVerb<Extra extends Metadata> {
  /** Adds credits. Records the plugin's own granted event. */
  grant(amount: number, metadata: Extra, options?: RecordOptions): Promise<void>
}

export type CreditsVerbs<
  Spent extends SumReducer | undefined,
  Grants extends SumReducer | undefined,
  Extra extends Metadata,
> = MeterQuery & {
  /** Pre-flight: can this identity, or a holder above it, cover `amount`? */
  check(options: { readonly estimate: number }): Promise<CheckResult>
  /** Records a debit after the work is done. */
  spend(
    amount: number,
    metadata: SpendMetadata<Spent, Extra>,
    options?: RecordOptions,
  ): Promise<void>
  /**
   * Check `estimate`, run the work, then spend what `settle` reports, or the
   * estimate when it reports no amount. A throw inside `run` spends nothing.
   */
  charge<T>(
    estimate: number,
    run: () => Promise<T>,
    settle: (result: T) => Settlement<SpendMetadata<Spent, Extra>>,
    options?: RecordOptions,
  ): Promise<Charge<T>>
} & (Grants extends SumReducer ? Record<never, never> : GrantVerb<Extra>)

export type CreditsSchema<
  Spent extends SumReducer | undefined,
  Grants extends SumReducer | undefined,
  Extra extends Metadata,
> = {
  readonly spent: SpentEvent<Spent, Extra>
  readonly credits: MeterDef
} & (Grants extends SumReducer
  ? Record<never, never>
  : { readonly granted: Own<Extra> })

/**
 * A prepaid pool of units the app debits at its own tariff: fifty for a
 * generation, ten for an edit, or tokens times a per-model rate. It is one
 * meter over two sum reducers, spends against credits. Plans top it up with
 * `included(wallet.credits, n)`, purchases with `grant` or with an existing
 * purchase reducer passed as `grants`, which lets a live ledger keep its
 * history. `charge` checks the estimate, runs the work, then spends what it
 * actually cost.
 */
export const credits = <
  Spent extends SumReducer | undefined = undefined,
  Grants extends SumReducer | undefined = undefined,
  Extra extends Metadata = Record<never, never>,
>({
  key = 'credits',
  price,
  spent,
  grants,
}: CreditsOptions<Spent, Grants, Extra>): PluginDef<
  'credits',
  CreditsSchema<Spent, Grants, Extra>,
  CreditsVerbs<Spent, Grants, Extra>,
  MeterSnapshot
> &
  CreditsSchema<Spent, Grants, Extra> => {
  if (key === '') throw new Error('credits: empty key')
  for (const [name, reducer] of [
    ['spent', spent],
    ['grants', grants],
  ] as const) {
    if (reducer && reducer.aggregation.func !== 'sum')
      throw new Error(`credits: ${name} must be a sum reducer`)
  }
  const spentEvent: EventDef = spent
    ? spent.filter.event
    : event(`${key}.spent`)
  const amountKey = spent ? spent.aggregation.property : 'amount'
  const usage = spent ?? sum(spentEvent, 'amount' as never)
  const granted = grants
    ? undefined
    : event<{ amount: number }>(`${key}.granted`)
  const creditReducer: SumReducer =
    grants ?? sum(`${key}-granted`, granted!, 'amount')

  const schema: Record<string, unknown> = {
    spent: spentEvent,
    credits: meter(key, { reducer: usage as never, creditReducer, price }),
    ...(granted && { granted }),
  }

  return plugin('credits', {
    schema: schema as unknown as CreditsSchema<Spent, Grants, Extra>,
    runtime: (queries): CreditsVerbs<Spent, Grants, Extra> => {
      const meters = queries.meters as Readonly<Record<string, MeterQuery>>
      const events = queries.events as Readonly<
        Record<
          string,
          { record(metadata: Metadata, options?: RecordOptions): Promise<void> }
        >
      >
      const pool = meters.credits!
      const spend = (
        amount: number,
        metadata: Metadata,
        options?: RecordOptions,
      ) => events.spent!.record({ ...metadata, [amountKey]: amount }, options)
      const verbs = {
        ...pool,
        spend,
        charge: async <T>(
          estimate: number,
          run: () => Promise<T>,
          settle: (result: T) => Settlement<Metadata>,
          options?: RecordOptions,
        ): Promise<Charge<T>> => {
          const check = await pool.check({ estimate })
          if (!check.allowed) return { charged: false, check }
          const result = await run()
          const { amount = estimate, ...metadata } = settle(result)
          await spend(amount, metadata, options)
          return { charged: true, amount, result, check }
        },
        ...(granted && {
          grant: (
            amount: number,
            metadata: Metadata,
            options?: RecordOptions,
          ) => events.granted!.record({ ...metadata, amount }, options),
        }),
      }
      return verbs as unknown as CreditsVerbs<Spent, Grants, Extra>
    },
    // One meter, so `snapshot().meters.wallet` is its balance.
    snapshot: (meters) =>
      (meters as Readonly<Record<string, MeterSnapshot>>).credits!,
  })
}
