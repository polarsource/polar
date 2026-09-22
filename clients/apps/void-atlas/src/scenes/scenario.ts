import type { Ir } from '@void/sdk/config'

const GB = 1_000_000_000

/** The three numbers the dashboard's Simulate view lets you move. */
export interface Levers {
  /** Monthly fee in dollars. */
  readonly fee: number
  /** Bytes covered by the fee before overage starts. */
  readonly included: number
  /** Dollars per byte above the allowance. */
  readonly unitAmount: number
}

export interface Customer {
  readonly name: string
  /** Bytes served over the replayed month. */
  readonly usage: number
}

export interface CustomerBill {
  readonly name: string
  readonly usage: number
  readonly base: number
  readonly scenario: number
  readonly delta: number
}

export interface Replay {
  readonly rows: readonly CustomerBill[]
  readonly base: number
  readonly scenario: number
}

/** Levers read off a compiled config, the way the dashboard reads a version. */
export const leversOf = (ir: Ir, product: string, meter: string): Levers => {
  const p = ir.products.find((candidate) => candidate.slug === product)!
  const m = ir.meters.find((candidate) => candidate.slug === meter)!
  return {
    fee: p.price.amount,
    included: p.meters.find((term) => term.slug === meter)!.included,
    unitAmount: m.unit_amount,
  }
}

const cents = (amount: number) => Math.round(amount * 100) / 100

/** Fee plus overage. Nothing else about billing is simulated. */
export const bill = (levers: Levers, usage: number): number =>
  cents(levers.fee + Math.max(0, usage - levers.included) * levers.unitAmount)

/** The same month billed under two price books. */
export const replay = (
  base: Levers,
  scenario: Levers,
  customers: readonly Customer[],
): Replay => {
  const rows = customers.map((customer) => {
    const before = bill(base, customer.usage)
    const after = bill(scenario, customer.usage)
    return {
      name: customer.name,
      usage: customer.usage,
      base: before,
      scenario: after,
      delta: cents(after - before),
    }
  })
  return {
    rows,
    base: cents(rows.reduce((sum, row) => sum + row.base, 0)),
    scenario: cents(rows.reduce((sum, row) => sum + row.scenario, 0)),
  }
}

export const gb = (bytes: number) =>
  `${(bytes / GB).toLocaleString('en-US', { maximumFractionDigits: 1 })} GB`
export const perGb = (unitAmount: number) =>
  `$${(unitAmount * GB).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / GB`
export const dollars = (amount: number) =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Revenue across every customer by the end of each day, with the fee charged
 * on day one and usage spread evenly over the month. The two curves start
 * apart by the fee difference and converge or cross as overage accrues.
 */
export const cumulative = (
  levers: Levers,
  customers: readonly Customer[],
  days = 30,
): number[] =>
  Array.from({ length: days }, (_, index) =>
    cents(
      customers.reduce(
        (total, customer) =>
          total +
          levers.fee +
          Math.max(0, (customer.usage * (index + 1)) / days - levers.included) *
            levers.unitAmount,
        0,
      ),
    ),
  )
