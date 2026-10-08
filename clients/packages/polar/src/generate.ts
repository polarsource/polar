import { Effect } from 'effect'
import { validateConfig } from './schema/config'
import type { BenefitConfig } from './schema/benefit'
import type { MeterConfig, MeterFilter } from './schema/meter'
import { majorAmount, scaleRate } from './schema/money'
import type { Currency, Scale } from './schema/money'
import type { PriceConfig } from './schema/price'
import type { ProductConfig } from './schema/product'

const literal = (value: string | number | boolean): string =>
  Object.is(value, -0) ? '-0' : JSON.stringify(value)

const key = (value: string): string =>
  value === '__proto__' ? `[${literal(value)}]` : literal(value)

const renderCondition = (
  condition: MeterFilter['clauses'][number],
  imports: Set<string>,
): string => {
  if ('conjunction' in condition) {
    imports.add(condition.conjunction)
    return `${condition.conjunction}(${condition.clauses.map((clause) => renderCondition(clause, imports)).join(', ')})`
  }
  const helper =
    condition.operator === 'not_like' ? 'notLike' : condition.operator
  imports.add(helper)
  return `${helper}(${literal(condition.property)}, ${literal(condition.value)})`
}

const renderMeter = (meter: MeterConfig, imports: Set<string>): string => {
  const lines = [`meter(${literal(meter.name)})`]
  const filter = meter.filter
  if (filter.conjunction === 'or' || filter.clauses.length > 0) {
    const [only] = filter.clauses
    const condition =
      filter.conjunction === 'and' &&
      filter.clauses.length === 1 &&
      only &&
      'property' in only
        ? only
        : filter
    lines.push(`.where(${renderCondition(condition, imports)})`)
  }

  if (meter.unit === 'custom') {
    lines.push(`.unit("custom", ${literal(meter.custom_label)})`)
  } else if (meter.unit === 'token') {
    lines.push('.unit("token")')
  }

  const aggregation = meter.aggregation
  lines.push(
    aggregation.func === 'count'
      ? '.count()'
      : `.${aggregation.func}(${literal(aggregation.property)})`,
  )
  return lines.join('\n')
}

const renderBenefit = (
  benefit: BenefitConfig,
  helpers: Set<string>,
): string => {
  const name = literal(benefit.description)
  if (benefit.type === 'feature_flag') {
    helpers.add('flag')
    return `flag(${name})`
  }
  helpers.add('credits')
  const { meter_external_id, units, rollover } = benefit.properties
  return [
    `credits(${name})`,
    `.meter(${literal(meter_external_id)})`,
    `.units(${literal(units)})`,
    ...(rollover ? ['.rollover()'] : []),
  ].join('\n')
}

const scaleHelpers: Partial<Record<Scale, string>> = {
  1_000: 'perThousand',
  1_000_000: 'perMillion',
}

// The currencies `@polar-sh/polar` exports a helper for.
const shorthands: Partial<Record<Currency, string>> = {
  usd: 'usd',
  eur: 'eur',
  try: 'lira',
  gbp: 'gbp',
  ils: 'ils',
  inr: 'inr',
  aud: 'aud',
  cad: 'cad',
  jpy: 'jpy',
  chf: 'chf',
  krw: 'krw',
  brl: 'brl',
}

const renderMoney = (
  currency: Currency,
  rate: string,
  imports: Set<string>,
): string => {
  const { amount, per } = scaleRate(rate)
  const shorthand = shorthands[currency]
  imports.add(shorthand ?? 'currency')
  const money = `${shorthand ?? `currency(${literal(currency)})`}(${majorAmount(currency, amount)})`
  if (per === 1) return money
  const helper = scaleHelpers[per]
  imports.add(helper ?? 'per')
  return helper === undefined
    ? `per(${per.toLocaleString('en-US').replaceAll(',', '_')}, ${money})`
    : `${helper}(${money})`
}

type PriceOf<Type extends PriceConfig['amount_type']> = Extract<
  PriceConfig,
  { readonly amount_type: Type }
>

type Tiers = PriceOf<'metered_tiers'>['tiers']

const tiersOf = (price: PriceConfig): Tiers['tiers'] =>
  'tiers' in price ? price.tiers.tiers : []

// Everything about a price except its currency and amounts, so one builder
// call can describe the price in every currency.
const structureOf = (price: PriceConfig): string =>
  JSON.stringify([
    price.amount_type,
    'meter_external_id' in price ? price.meter_external_id : null,
    'tiers' in price ? price.tiers.type : null,
    tiersOf(price).map(({ bound }) => bound ?? null),
    'minimum_units' in price ? (price.minimum_units ?? null) : null,
  ])

const groupPrices = (
  prices: ReadonlyArray<PriceConfig>,
): ReadonlyArray<readonly [PriceConfig, ...PriceConfig[]]> => {
  const groups: [PriceConfig, ...PriceConfig[]][] = []
  for (const price of prices) {
    const group = groups.find(
      ([first, ...rest]) =>
        structureOf(first) === structureOf(price) &&
        ![first, ...rest].some(
          ({ price_currency }) => price_currency === price.price_currency,
        ),
    )
    if (group === undefined) {
      groups.push([price])
    } else {
      group.push(price)
    }
  }
  return groups
}

const renderAmounts = (
  group: ReadonlyArray<PriceConfig>,
  amountOf: (price: PriceConfig) => string | undefined,
  imports: Set<string>,
): string =>
  group
    .flatMap((price) => {
      const amount = amountOf(price)
      return amount === undefined
        ? []
        : [renderMoney(price.price_currency, amount, imports)]
    })
    .join(', ')

const renderTiers = (
  type: Tiers['type'],
  group: readonly [PriceConfig, ...PriceConfig[]],
  helpers: Set<string>,
  imports: Set<string>,
): string[] => {
  helpers.add('tier')
  const rates = tiersOf(group[0]).map((_, index) =>
    group.map((price) => tiersOf(price)[index]?.unit_amount),
  )
  const isFreeTier = (index: number) =>
    rates[index]?.every((rate) => Number(rate) === 0) ?? false
  // A price whose tiers are all free would take the product's currencies,
  // so only use `.free()` when another tier sets the price's currencies.
  const useFree = rates.some((_, index) => !isFreeTier(index))
  return [
    `.${type}(`,
    ...tiersOf(group[0]).map(({ bound }, index) => {
      const max = bound === undefined ? '' : `.max(${literal(bound)})`
      if (!useFree || !isFreeTier(index)) {
        return `  tier()${max}.amount(${renderAmounts(
          group,
          (price) => tiersOf(price)[index]?.unit_amount,
          imports,
        )}),`
      }
      return type === 'graduated' && index === 0 && bound !== undefined
        ? `  tier().included(${literal(bound)}),`
        : `  tier()${max}.free(),`
    }),
    ')',
  ]
}

const renderCap = (
  group: ReadonlyArray<PriceConfig>,
  imports: Set<string>,
): string[] => {
  const caps = renderAmounts(
    group,
    (price) =>
      'cap_amount' in price && price.cap_amount !== undefined
        ? String(price.cap_amount)
        : undefined,
    imports,
  )
  return caps === '' ? [] : [`.cap(${caps})`]
}

const isFree = (group: ReadonlyArray<PriceConfig>): boolean =>
  group.every(
    (price) => price.amount_type === 'fixed' && price.price_amount === 0,
  )

const renderPrice = (
  group: readonly [PriceConfig, ...PriceConfig[]],
  productCurrencies: ReadonlyArray<Currency>,
  helpers: Set<string>,
  imports: Set<string>,
): string => {
  const [first] = group
  switch (first.amount_type) {
    case 'fixed': {
      const currencies = group.map(({ price_currency }) => price_currency)
      if (
        isFree(group) &&
        currencies.length === productCurrencies.length &&
        currencies.every((code, index) => code === productCurrencies[index])
      ) {
        helpers.add('free')
        return 'free()'
      }
      helpers.add('fixed')
      return `fixed().amount(${renderAmounts(
        group,
        (price) =>
          'price_amount' in price ? String(price.price_amount) : undefined,
        imports,
      )})`
    }
    case 'seat_based':
    case 'unit_based': {
      const helper = first.amount_type === 'seat_based' ? 'seats' : 'units'
      helpers.add(helper)
      const bound = first.tiers.tiers[0]?.bound
      const lines =
        first.tiers.type === 'volume' && first.tiers.tiers.length === 1
          ? [
              `${helper}()`,
              '.flat()',
              `.amount(${renderAmounts(group, (price) => tiersOf(price)[0]?.unit_amount, imports)})`,
              ...(bound === undefined ? [] : [`.max(${literal(bound)})`]),
            ]
          : [
              `${helper}()`,
              ...renderTiers(first.tiers.type, group, helpers, imports),
            ]
      if (first.minimum_units !== undefined) {
        lines.push(`.min(${literal(first.minimum_units)})`)
      }
      return lines.join('\n')
    }
    case 'metered_unit':
    case 'metered_tiers': {
      helpers.add('meter')
      return [
        `meter(${literal(first.meter_external_id)})`,
        ...(first.amount_type === 'metered_unit'
          ? [
              '.flat()',
              `.amount(${renderAmounts(
                group,
                (price) =>
                  'unit_amount' in price ? price.unit_amount : undefined,
                imports,
              )})`,
            ]
          : renderTiers(first.tiers.type, group, helpers, imports)),
        ...renderCap(group, imports),
      ].join('\n')
    }
  }
}

const cadences = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
} as const

const renderProduct =
  (imports: Set<string>) =>
  (product: ProductConfig, helpers: Set<string>): string => {
    helpers.add('product')
    const groups = groupPrices(product.prices)
    const productCurrencies = groups
      .find((group) => !isFree(group))
      ?.map(({ price_currency }) => price_currency) ?? ['usd']
    const prices = groups.map(
      (group) =>
        `  ${renderPrice(group, productCurrencies, helpers, imports).replaceAll('\n', '\n    ')},`,
    )
    const {
      recurring_interval: interval,
      recurring_interval_count: count,
      trial_interval: trialInterval,
      trial_interval_count: trialCount,
    } = product
    const plural = (unit: string, amount: number) =>
      literal(amount === 1 ? unit : `${unit}s`)
    return [
      `product(${literal(product.name)})`,
      '.prices(',
      ...prices,
      ')',
      interval === null
        ? '.once()'
        : count === null || count === 1
          ? `.recurring(${literal(cadences[interval])})`
          : `.recurring(${literal(count)}, ${plural(interval, count)})`,
      ...(interval !== null &&
      trialInterval !== undefined &&
      trialCount !== undefined
        ? [
            `.trial(${literal(trialCount)}, ${plural(trialInterval, trialCount)})`,
          ]
        : []),
      ...(product.benefit_external_ids.length === 0
        ? []
        : [
            `.grants([${product.benefit_external_ids.map(literal).join(', ')}])`,
          ]),
    ].join('\n')
  }

const renderEntries = <Resource extends { readonly external_id: string }>(
  property: string,
  resources: ReadonlyArray<Resource>,
  render: (resource: Resource, helpers: Set<string>) => string,
): string[] => {
  const helpers = new Set<string>()
  const ids = resources.map((resource) => resource.external_id)
  const objectKeys = Object.keys(
    Object.fromEntries(ids.map((id) => [id, null])),
  )
  const useEntries =
    objectKeys.length !== ids.length ||
    objectKeys.some((id, index) => id !== ids[index])
  const lines = resources.map((resource) => {
    const expression = render(resource, helpers).replaceAll('\n', '\n      ')
    return useEntries
      ? `    [${literal(resource.external_id)}, ${expression}],`
      : `    ${key(resource.external_id)}: ${expression},`
  })
  const parameters =
    helpers.size === 0 ? '()' : `({ ${[...helpers].join(', ')} })`
  return [
    `  ${property}: ${parameters} => (${useEntries ? '[' : '{'}`,
    ...lines,
    `  ${useEntries ? ']' : '}'}),`,
  ]
}

export const generateConfig = Effect.fnUntraced(function* (input: unknown) {
  const config = yield* validateConfig(input)
  const imports = new Set(['defineConfig'])
  const meters = renderEntries('meters', config.meters, (meter, helpers) => {
    helpers.add('meter')
    return renderMeter(meter, imports)
  })
  const benefits =
    config.benefits === undefined
      ? []
      : renderEntries('benefits', config.benefits, renderBenefit)
  const products =
    config.products === undefined
      ? []
      : renderEntries('products', config.products, renderProduct(imports))

  return [
    `import { ${[...imports].join(', ')} } from '@polar-sh/polar'`,
    '',
    'export default defineConfig({',
    ...meters,
    ...benefits,
    ...products,
    '})',
    '',
  ].join('\n')
})
