/**
 * Billing-as-code, embedded DSL — mirrors how Polar meters are defined.
 *
 * A meter line filters events by their `name` and applies an Aggregation over
 * `metadata`, then prices the resulting quantity:
 *
 *   product("api-access")
 *     .meter("tokens",   sumOf("amount"), perUnit(micros(2n)))   // $0.000002 / token
 *     .meter("requests", count(),         perUnit(micros(50n)))
 *     .meter("seats",    maxOf("amount"), perUnit(cents(500)))   // $5.00 / peak seat
 *
 * `product(...)` is *code* (type-safe, composable); the `Plan` it builds is
 * *data* (versionable, diffable, replayable). The engine only consumes the data.
 */
import type { Aggregation, MeterState } from './meter'
import type { Money } from './money'
import { mul } from './money'

/** How a meter's quantity becomes money. Per-unit for now; tiers/etc. compose in later. */
export interface PerUnit {
  readonly kind: 'perUnit'
  readonly price: Money
}

export const perUnit = (price: Money): PerUnit => ({ kind: 'perUnit', price })

export const priceOf = (p: PerUnit, quantity: bigint): Money =>
  mul(p.price, quantity)

/** One metered line: match events named `name`, aggregate over metadata, price the result. */
export interface MeterLine {
  /** Matches `event.name`. */
  readonly name: string
  readonly aggregation: Aggregation<MeterState>
  readonly price: PerUnit
}

/** A Plan is the serializable billing program the engine executes. */
export interface Plan {
  readonly product: string
  readonly lines: readonly MeterLine[]
}

class PlanBuilder {
  private readonly lines: MeterLine[] = []
  constructor(private readonly product: string) {}

  meter<S extends MeterState>(
    name: string,
    aggregation: Aggregation<S>,
    price: PerUnit,
  ): this {
    // Stored existentially: a concrete Aggregation<bigint> doesn't structurally
    // widen to Aggregation<MeterState> (step is contravariant in its state), but
    // it's sound — the engine only feeds a meter the state it produced.
    this.lines.push({
      name,
      aggregation: aggregation as unknown as Aggregation<MeterState>,
      price,
    })
    return this
  }

  build(): Plan {
    // Sort by meter name so the Plan — and every invoice from it — has a stable,
    // deterministic line order regardless of authoring order.
    const lines = [...this.lines].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )
    return { product: this.product, lines }
  }
}

/** Entry point: `product("api").meter(...).meter(...).build()` */
export const product = (name: string): PlanBuilder => new PlanBuilder(name)
