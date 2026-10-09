import { errors, RuntimeSDK } from '@polar-sh/polar'
import { log } from './log'
import config from './polar.config'

const accessToken = process.env.POLAR_ACCESS_TOKEN

if (!accessToken) {
  throw new Error('POLAR_ACCESS_TOKEN is required in .env.local')
}

export const polar = RuntimeSDK(config, {
  accessToken,
  environment: 'sandbox',
  baseUrl: 'http://127.0.0.1:8000',
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const findPlan = async (externalId: 'free' | 'pro') => {
  const { items: products } = await polar.sdk.products.list({
    is_recurring: true,
    limit: 100,
  })
  const plan = products.find((product) => product.external_id === externalId)
  if (!plan) {
    throw new Error(`The ${externalId} plan is not deployed in this environment.`)
  }
  return plan
}

export const getProPrice = async () => {
  const pro = await findPlan('pro')
  const price = pro.prices.find(
    (price) => price.amount_type === 'fixed' && price.price_currency === 'usd',
  )
  if (price?.amount_type !== 'fixed') {
    throw new Error('The pro plan has no fixed USD price.')
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'usd',
  }).format(price.price_amount / 100)
}

export const createProCheckout = async (externalId: string, origin: string) => {
  const pro = await findPlan('pro')
  const { items } = await polar.sdk.subscriptions.list({
    external_customer_id: externalId,
    active: true,
    limit: 1,
  })

  const checkout = await polar.sdk.checkouts.create({
    products: [pro.id],
    external_customer_id: externalId,
    // Upgrades the free subscription instead of creating a second one
    subscription_id: items[0]?.id,
    success_url: `${origin}/?checkout_id={CHECKOUT_ID}`,
    return_url: origin,
  })
  return checkout.url
}

export const isPro = async (externalId: string) => {
  const pro = await findPlan('pro')
  const { items } = await polar.sdk.subscriptions.list({
    external_customer_id: externalId,
    product_id: pro.id,
    active: true,
    limit: 1,
  })
  if (items.length === 0) return false

  // Benefits are granted asynchronously after the subscription becomes active
  const { granted } = await polar
    .actor({ externalCustomerId: externalId })
    .access('custom_servers')
  return granted
}

export const ensureFreePlan = async (email: string, externalId: string) => {
  try {
    await polar.sdk.customers.getExternal(externalId)
  } catch (error) {
    if (!(error instanceof errors.ResourceNotFound)) throw error
    log('Creating customer', externalId)
    await polar.sdk.customers.create({ email, external_id: externalId })
  }

  const { items } = await polar.sdk.subscriptions.list({
    external_customer_id: externalId,
    active: true,
    limit: 1,
  })
  if (items.length > 0) return

  const freePlan = await findPlan('free')

  log('Subscribing customer to the free plan', externalId)
  await polar.sdk.subscriptions.create({
    product_id: freePlan.id,
    external_customer_id: externalId,
  })

  // Credits are granted asynchronously after the subscription is created
  const customer = polar.actor({ externalCustomerId: externalId })
  const span = log.start('Waiting for free credits')
  const start = performance.now()
  while ((await customer.balance('tool_call')).balance === 0) {
    if (performance.now() - start > 10000) break
    await wait(500)
  }
  span.end()
}

export const callTool = async (
  externalId: string,
  server: 'builtin' | 'custom',
) => {
  const customer = polar.actor({ externalCustomerId: externalId })

  if (server === 'custom') {
    const benefitsSpan = log.start('Checking benefits')
    const { granted } = await customer.access('custom_servers')
    benefitsSpan.end()

    if (!granted) {
      log('Customer has no custom servers benefit')
      return { paywall: true }
    }
  }

  // Doesn't wait for a pristine balance, so it may not reflect the latest calls yet
  const { balance } = await customer.balance('tool_call')

  if (server === 'builtin' && balance === 0) {
    log('Not enough balance, cannot do the thing')
    return { paywall: true }
  }

  const ingestSpan = log.start('Ingesting tool_call')
  await customer.track('tool_call', {
    tool: 'search',
    server,
    success: true,
    duration_ms: 420,
  })
  ingestSpan.end()

  return { paywall: false }
}
