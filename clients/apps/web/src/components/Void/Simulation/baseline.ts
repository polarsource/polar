import {
  VoidScenario,
  VoidScenarioPatch,
  VoidConfigProduct,
  VoidConfiguration,
  VoidMeterTerms,
} from '../api'
import { Assumptions, ScenarioLevers } from './types'

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  usageGrowth: 8,
  newCustomers: 3,
  churnTolerance: 20,
  churnElasticity: 15,
}

const termsOf = (
  entry: VoidConfigProduct['meters'][number],
): { slug: string } & VoidMeterTerms =>
  typeof entry === 'string'
    ? { slug: entry, included: 0, limit: 'hard', rollover_cap: 0 }
    : entry

const cents = (amount: string) => Math.round(Number(amount) * 100)

/**
 * Levers of one configuration. Plans are recurring products, their allowance
 * is the `included` units of the first meter they bill. Meter prices are per
 * single unit, in cents, so the engine's `per` is always 1.
 */
export const leversFromConfiguration = (
  configuration: VoidConfiguration,
  assumptions: Assumptions,
): ScenarioLevers => ({
  plans: configuration.products
    .filter((product) => product.price.type === 'recurring')
    .map((product) => ({
      id: product.slug,
      name: product.name,
      monthlyPrice: cents(product.price.amount),
      includedUsage: product.meters[0]
        ? termsOf(product.meters[0]).included
        : 0,
    })),
  meters: configuration.meters.map((meter) => ({
    id: meter.slug,
    name: meter.slug,
    unit: 'unit',
    per: 1,
    price: Number(meter.unit_amount) * 100,
  })),
  assumptions,
})

const unitAmount = (priceCents: number) =>
  (priceCents / 100).toFixed(12).replace(/0+$/, '').replace(/\.$/, '')

/** The configuration-level diff the backend stores for a scenario. */
export const patchFromLevers = (
  levers: ScenarioLevers,
  base: VoidConfiguration,
): VoidScenarioPatch => {
  const patch: VoidScenarioPatch = { products: {}, meters: {} }
  for (const plan of levers.plans) {
    const product = base.products.find((p) => p.slug === plan.id)
    if (!product || product.price.type !== 'recurring') continue
    const changes: VoidScenarioPatch['products'][string] = {}
    if (cents(product.price.amount) !== plan.monthlyPrice) {
      changes.price = {
        ...product.price,
        amount: (plan.monthlyPrice / 100).toString(),
      }
    }
    const first = product.meters[0] ? termsOf(product.meters[0]) : null
    if (first && first.included !== plan.includedUsage) {
      const { slug, ...terms } = first
      changes.meters = { [slug]: { ...terms, included: plan.includedUsage } }
    }
    if (Object.keys(changes).length > 0) patch.products[plan.id] = changes
  }
  for (const meter of levers.meters) {
    const current = base.meters.find((m) => m.slug === meter.id)
    if (!current) continue
    if (Number(current.unit_amount) * 100 !== meter.price) {
      patch.meters[meter.id] = { unit_amount: unitAmount(meter.price) }
    }
  }
  return patch
}

export const changedLevers = (
  levers: ScenarioLevers,
  base: ScenarioLevers,
): string[] => {
  const changed: string[] = []
  levers.plans.forEach((plan) => {
    const basePlan = base.plans.find((p) => p.id === plan.id)
    if (!basePlan) return
    if (plan.monthlyPrice !== basePlan.monthlyPrice)
      changed.push(`${plan.name} price`)
    if (plan.includedUsage !== basePlan.includedUsage)
      changed.push(`${plan.name} allowance`)
  })
  levers.meters.forEach((meter) => {
    const baseMeter = base.meters.find((m) => m.id === meter.id)
    if (baseMeter && meter.price !== baseMeter.price)
      changed.push(`${meter.name} price`)
  })
  return changed
}

/** The base configuration with the levers applied, for optimistic display. */
export const configurationFromLevers = (
  levers: ScenarioLevers,
  base: VoidConfiguration,
): VoidConfiguration => {
  const patch = patchFromLevers(levers, base)
  return {
    ...base,
    products: base.products.map((product) => {
      const changes = patch.products[product.slug]
      if (!changes) return product
      return {
        ...product,
        price: changes.price ?? product.price,
        meters: product.meters.map((entry) => {
          const { slug, ...terms } = termsOf(entry)
          const next = changes.meters?.[slug]
          return next ? { slug, ...next } : { slug, ...terms }
        }),
      }
    }),
    meters: base.meters.map((meter) => {
      const next = patch.meters[meter.slug]?.unit_amount
      return next ? { ...meter, unit_amount: next } : meter
    }),
  }
}

export const baseLeversOf = (
  scenario: VoidScenario,
  assumptions: Assumptions,
) => leversFromConfiguration(scenario.base_configuration, assumptions)
