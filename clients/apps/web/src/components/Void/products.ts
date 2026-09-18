import { formatCurrency } from '@polar-sh/currency'
import { VoidDeploy, VoidMeterTerms, VoidPrice, activeDeploy } from './api'

export interface VoidProductMeter {
  id: string
  version_id: string
  name: string
  slug: string
  usage_reducer_id: string
  credit_reducer_id: string
  unit_amount: string
  currency: string
  created_at: string
}

export interface VoidProductEntitlement {
  id: string
  slug: string
  name: string
  description: string | null
  created_at: string
}

export interface VoidProduct {
  id: string
  version_id: string
  slug: string
  name: string
  description: string | null
  price: VoidPrice
  meters: VoidProductMeter[]
  meter_terms: Record<string, VoidMeterTerms>
  entitlements: VoidProductEntitlement[]
  created_at: string
}

export const productHref = (base: string, id: string) =>
  `${base}/definition/products/${id}`

export const priceCents = (amount: string) => Math.round(Number(amount) * 100)

export const formatProductPrice = (price: VoidPrice): string => {
  const amount = formatCurrency('statistics')(
    priceCents(price.amount),
    price.currency,
  )
  if (price.type === 'one_time') return amount
  const period =
    price.interval_count === 1
      ? price.interval
      : `${price.interval_count} ${price.interval}s`
  return `${amount} / ${period}`
}

export const priceKind = (price: VoidPrice): 'recurring' | 'one_time' =>
  price.type

export const termsOf = (
  product: VoidProduct,
  meter: VoidProductMeter,
): VoidMeterTerms =>
  product.meter_terms[meter.slug] ?? {
    included: 0,
    limit: 'hard',
    rollover_cap: 0,
  }

export const productsOfActive = (
  products: VoidProduct[],
  deploys: VoidDeploy[],
): VoidProduct[] => {
  const active = activeDeploy(deploys)
  if (!active) return products
  return products.filter((product) => product.version_id === active.version_id)
}

const CREATED = '2026-03-01T00:00:00.000Z'
const VERSION = 'main'

const meter = (
  id: string,
  name: string,
  slug: string,
  unitAmount: string,
): VoidProductMeter => ({
  id,
  version_id: VERSION,
  name,
  slug,
  usage_reducer_id: 'red_usage',
  credit_reducer_id: 'red_credits',
  unit_amount: unitAmount,
  currency: 'usd',
  created_at: CREATED,
})

const entitlement = (
  id: string,
  slug: string,
  name: string,
): VoidProductEntitlement => ({
  id,
  slug,
  name,
  description: null,
  created_at: CREATED,
})

const OUTPUT = meter('meter_1', 'Output tokens', 'output-tokens', '0.003')
const INPUT = meter('meter_2', 'Input tokens', 'input-tokens', '0.0005')
const TOOLS = meter('meter_3', 'Tool calls', 'tool-calls', '0.1')
const SANDBOX = meter('meter_4', 'Sandbox minutes', 'sandbox-minutes', '2')

const API = entitlement('ent_1', 'api-access', 'API access')
const PRIORITY = entitlement(
  'ent_2',
  'priority-lane',
  'Priority inference lane',
)

export const FIXTURE_PRODUCTS: VoidProduct[] = [
  {
    id: 'prod_scale',
    version_id: VERSION,
    slug: 'scale',
    name: 'Scale',
    description: 'Production inference at volume, with a priority lane.',
    price: {
      type: 'recurring',
      interval: 'month',
      interval_count: 1,
      amount: '99',
      currency: 'usd',
    },
    meters: [OUTPUT, INPUT, TOOLS, SANDBOX],
    meter_terms: {
      'output-tokens': {
        included: 2_000_000,
        limit: 'soft',
        rollover_cap: 500_000,
      },
      'input-tokens': { included: 8_000_000, limit: 'soft', rollover_cap: 0 },
      'tool-calls': { included: 50_000, limit: 'hard', rollover_cap: 0 },
      'sandbox-minutes': { included: 1_200, limit: 'hard', rollover_cap: 0 },
    },
    entitlements: [API, PRIORITY],
    created_at: CREATED,
  },
  {
    id: 'prod_team',
    version_id: VERSION,
    slug: 'team',
    name: 'Team',
    description: 'Shared allowance for a working group.',
    price: {
      type: 'recurring',
      interval: 'month',
      interval_count: 1,
      amount: '30',
      currency: 'usd',
    },
    meters: [OUTPUT, INPUT, TOOLS],
    meter_terms: {
      'output-tokens': { included: 400_000, limit: 'hard', rollover_cap: 0 },
      'input-tokens': { included: 1_600_000, limit: 'hard', rollover_cap: 0 },
      'tool-calls': { included: 10_000, limit: 'hard', rollover_cap: 0 },
    },
    entitlements: [API],
    created_at: '2026-02-01T00:00:00.000Z',
  },
  {
    id: 'prod_starter',
    version_id: VERSION,
    slug: 'starter',
    name: 'Starter',
    description: 'A small monthly allowance to get started.',
    price: {
      type: 'recurring',
      interval: 'month',
      interval_count: 1,
      amount: '9.9',
      currency: 'usd',
    },
    meters: [OUTPUT, INPUT],
    meter_terms: {
      'output-tokens': { included: 80_000, limit: 'hard', rollover_cap: 0 },
      'input-tokens': { included: 320_000, limit: 'hard', rollover_cap: 0 },
    },
    entitlements: [API],
    created_at: '2026-01-01T00:00:00.000Z',
  },
]
