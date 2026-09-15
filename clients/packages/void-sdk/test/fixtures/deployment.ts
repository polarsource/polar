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
} from '../../src/config/index'

const usage = event<{ tokens: number }>('deployment.usage')
const tokens = meter('deployment-tokens', {
  reducer: sum(usage, 'tokens'),
  price: { amount: 0.002, currency: 'usd' },
})
const support = entitlement('deployment-support', { name: 'Priority support' })
const pro = product('deployment-pro', {
  name: 'Deployment Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [included(tokens, 1000, { limit: 'hard', rolloverCap: 500 })],
  entitlements: [support],
})

export const config = defineConfig({ schema: { usage, tokens, support, pro } })
