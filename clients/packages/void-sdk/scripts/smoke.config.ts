import {
  defineConfig,
  entitlement,
  event,
  included,
  meter,
  product,
  recurring,
  sum,
  usd,
} from '../src/config/index'

const usage = event<{ units: number }>('smoke.usage')
const grant = event<{ units: number }>('smoke.credit.granted')
const credits = sum('smoke-credits', grant, 'units')
const units = meter('smoke-units', {
  reducer: sum('smoke-usage', usage, 'units'),
  creditReducer: credits,
  price: usd(0.002),
})
const support = entitlement('smoke-support', { name: 'Smoke support' })
const pro = product('smoke-pro', {
  name: 'Smoke Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [included(units, 100, { limit: 'hard', rolloverCap: 20 })],
  entitlements: [support],
})

export const config = defineConfig({
  schema: { usage, grant, units, support, pro },
})
