import { createVoid } from '../src/index'
import { config } from './void'

const client = createVoid(config, {
  apiUrl: process.env.VOID_API_URL!,
  token: process.env.VOID_TOKEN!,
})
const suffix = Date.now().toString(36)
const customerId = `sdk_demo_customer_${suffix}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const customer = await client.api.customers.create({
  external_id: customerId,
  email: `${customerId}@example.com`,
})
console.log('customer', customer.external_id)

const root = client.as(customerId)
const member = await client.ensure(`member_${suffix}`, { parent: customerId })
const crawl = await member.spawn()
console.log('spawned', crawl.id, 'chain', await crawl.chain())
console.log('customer via scope', (await crawl.customer())?.external_id)

await crawl.events.page.record({
  bytes: 7_400,
  host: 'docs.example.com',
  status: 'ok',
})
await member.events.page.record({
  bytes: 3_000,
  host: 'docs.example.com',
  status: 'error',
})

for (let i = 0; i < 20; i++) {
  const total = await root.meters.bandwidth.total()
  if (total >= 10_400) break
  await sleep(1000)
}
console.log('root bandwidth', await root.meters.bandwidth.total())
console.log('root indexed pages', await root.reducers.indexed.total())
console.log(
  'per identity',
  (await root.meters.bandwidth.usage({ groupBy: 'identity' })).map((s) => [
    s.identity,
    s.total,
  ]),
)
await client
  .ensure(`member_${suffix}`, { parent: 'someone_else' })
  .catch((e) => console.log('mismatch ->', e.message))

const subscription = await root.products.pro.subscribe()
console.log('subscribed', subscription.id, 'to', subscription.product.slug)
console.log(
  'cycles',
  (await root.subscriptions.cycles(subscription.id)).length,
  'closed so far',
)

// LLM tokens. `track` wraps any provider call and records one completion from
// the usage the result reports; the extractor is the only provider-specific line.
const preflight = await root.ai.check({
  model: 'claude-fable-5-1',
  inputTokens: 4_000,
  maxOutputTokens: 1_000,
})
console.log('preflight allowed', preflight.allowed, preflight.input.limit)
const reply = await member.ai.track(
  { model: 'claude-fable-5-1' },
  async () => ({
    text: 'hello',
    usage: { input_tokens: 1_200, output_tokens: 300 },
  }),
  (res) => ({ input: res.usage.input_tokens, output: res.usage.output_tokens }),
)
console.log('reply', reply.text)
// An unlisted model lands on the catch-all pair at its prices.
await member.ai.record({
  model: 'mistral-large',
  input_tokens: 500,
  output_tokens: 100,
})
for (let i = 0; i < 20; i++) {
  if (
    (await root.ai.models['claude-fable-5-1'].input.total()) >= 1_200 &&
    (await root.ai.other.input.total()) >= 500
  )
    break
  await sleep(1000)
}
const tokens = (await root.snapshot()).meters.ai
console.log(
  'fable input remaining',
  tokens.models['claude-fable-5-1'].input.remaining,
  'other input used',
  await root.ai.other.input.total(),
  'completions',
  await root.ai.completions.total(),
)

// Credits. A prepaid pool debited at the app's tariff: a build costs 50.
// `charge` checks, runs the work, then spends what `settle` reports.
await root.wallet.grant(60, {})
for (let i = 0; i < 20; i++) {
  if ((await root.wallet.balance()).remaining >= 60) break
  await sleep(1000)
}
const build = () => Promise.resolve({ pages: 3 })
const first = await root.wallet.charge(50, build, () => ({}))
for (let i = 0; i < 20; i++) {
  if ((await root.wallet.balance()).remaining <= 10) break
  await sleep(1000)
}
const second = await root.wallet.charge(50, build, () => ({}))
console.log(
  'first build charged',
  first.charged,
  'second',
  second.charged,
  second.charged ? '' : second.check.reason,
  'credits left',
  (await root.wallet.balance()).remaining,
)

await client.dispose()
