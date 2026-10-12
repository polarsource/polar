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

const findProducts = async (recurring: boolean) => {
  const { items } = await polar.sdk.products.list({
    is_recurring: recurring,
    limit: 100,
  })
  return items
}

const findPlan = async (externalId: 'free' | 'pro') => {
  const plan = (await findProducts(true)).find(
    (product) => product.external_id === externalId,
  )
  if (!plan) {
    throw new Error(
      `The ${externalId} plan is not deployed in this environment.`,
    )
  }
  return plan
}

type Product = Awaited<ReturnType<typeof findPlan>>

const formatUsdPrice = (product: Product) => {
  const price = product.prices.find(
    (price) => price.amount_type === 'fixed' && price.price_currency === 'usd',
  )
  if (price?.amount_type !== 'fixed') {
    throw new Error(
      `The ${product.external_id} product has no fixed USD price.`,
    )
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'usd',
    maximumFractionDigits: price.price_amount % 100 === 0 ? 0 : 2,
  }).format(price.price_amount / 100)
}

export const getProPrice = async () => formatUsdPrice(await findPlan('pro'))

const TOP_UPS = ['topup_100', 'topup_500', 'topup_1000'] as const

export type TopUp = (typeof TOP_UPS)[number]

const isTopUp = (externalId: string | null): externalId is TopUp =>
  TOP_UPS.includes(externalId as TopUp)

const creditedUnits = (product: Product) =>
  product.benefits.reduce(
    (units, benefit) =>
      benefit.type === 'meter_credit'
        ? units + benefit.properties.units
        : units,
    0,
  )

export const getTopUps = async () =>
  (await findProducts(false))
    .filter((product) => isTopUp(product.external_id))
    .sort((a, b) => creditedUnits(a) - creditedUnits(b))
    .map((product) => ({
      id: product.external_id as TopUp,
      units: creditedUnits(product),
      price: formatUsdPrice(product),
    }))

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

export const purchaseTopUp = async (externalId: string, topUp: TopUp) => {
  // Server actions accept any input, so don't trust the client's pack
  if (!isTopUp(topUp)) throw new Error(`Unknown top-up ${topUp}`)
  if (!(await isPro(externalId))) {
    return { error: 'Top-ups are only available on the Pro plan.' }
  }

  const topUpProduct = (await findProducts(false)).find(
    (product) => product.external_id === topUp,
  )
  if (!topUpProduct) {
    throw new Error(`The ${topUp} product is not deployed in this environment.`)
  }

  const actor = polar.actor({ externalCustomerId: externalId })
  const { balance } = await actor.balance('tool_call')
  const customer = await polar.sdk.customers.getExternal(externalId)

  log('Charging top-up off-session', topUp)
  const order = await polar.sdk.orders.create({
    customer_id: customer.id,
    product_id: topUpProduct.id,
    currency: 'usd',
  })

  try {
    // Charges the payment method saved during the Pro checkout
    await polar.sdk.orders.finalize(order.id, {})
  } catch (error) {
    if (
      error instanceof errors.OrdersFinalize402Error ||
      error instanceof errors.OrdersFinalize403Error
    ) {
      log('Top-up charge failed', error.error.detail)
      return { error: error.error.detail }
    }
    throw error
  }

  // Credits are granted asynchronously after the order is paid
  const span = log.start('Waiting for top-up credits')
  const start = performance.now()
  const target = balance + creditedUnits(topUpProduct)
  while ((await actor.balance('tool_call')).balance < target) {
    if (performance.now() - start > 10000) break
    await wait(500)
  }
  span.end()

  return { error: undefined }
}

export const callTool = async (
  externalId: string,
  server: 'builtin' | 'custom',
  count: number,
) => {
  const customer = polar.actor({ externalCustomerId: externalId })
  let granted: boolean | undefined

  if (server === 'custom') {
    const benefitsSpan = log.start('Checking benefits')
    ;({ granted } = await customer.access('custom_servers'))
    benefitsSpan.end()

    if (!granted) {
      log('Customer has no custom servers benefit')
      return { paywall: true, granted }
    }
  }

  // Doesn't wait for a pristine balance, so it may not reflect the latest calls yet
  const { balance } = await customer.balance('tool_call')

  if (server === 'builtin' && balance < count) {
    log('Not enough balance, cannot do the thing')
    return { paywall: true, balance, granted }
  }

  // One event per call, so tracking keeps the balance's pristine state accurate
  const ingestSpan = log.start(`Ingesting ${count} tool_call`)
  await customer.track(
    Array.from({ length: count }, () => ({
      name: 'tool_call' as const,
      metadata: {
        tool: 'search',
        server,
        success: true,
        duration_ms: 420,
      },
    })),
  )
  ingestSpan.end()

  return { paywall: false, balance, granted }
}
