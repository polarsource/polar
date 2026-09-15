/**
 * Metering and billing the Vercel AI SDK through Void.
 *
 * Tracking is always on: every completion records one `llm.completion` event
 * with its tokens, model and cost of goods, and the plugin folds that into a
 * `cost` meter and per-model token totals for the merchant.
 *
 * Billing is one choice. `billing` says how the customer pays, and the
 * product terms, the gate and the fallback ladder all speak that unit:
 *
 *   perToken   tokens per model, priced with a markup
 *   costPlus   dollars of provider cost, billed times a markup
 *   inCredits  credits from a prepaid pool, converted per model
 *
 * Two ways in, one event out. Creating the client registers AI SDK telemetry
 * for the plugin, so every call in the process is recorded as whichever
 * identity is ambient. `scope.ai.model(...)` wraps a model so every call is
 * also gated before the provider is called. Using both at once records once.
 */
import { generateText, streamText } from 'ai'
import {
  createVoid,
  defineConfig,
  included,
  product,
  recurring,
  usd,
} from '../src/index'
import {
  llm,
  costPlus,
  fallback,
  tags,
  inCredits,
  perCall,
  perThousandOutput,
  perToken,
  percent,
  vercelGateway,
} from '../src/plugins/index'

const models = [
  'anthropic/claude-opus-5',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4-5',
] as const

// Mode 1: per token.
export const ai = llm({
  gateway: vercelGateway(),
  models,
  billing: perToken(
    {
      'anthropic/claude-opus-5': {
        input: usd(0.000015),
        output: usd(0.000075),
      },
      'anthropic/claude-sonnet-5': {
        input: usd(0.000003),
        output: usd(0.000015),
      },
      'anthropic/claude-haiku-4-5': {
        input: usd(0.000001),
        output: usd(0.000005),
      },
      other: { input: usd(0.000004), output: usd(0.00002) }, // unknown models never bill free
    },
    { markup: percent(30) },
  ),
  tags: tags<{ feature: string }>(),
})
export const pro = product('pro', {
  name: 'Pro',
  price: recurring({ interval: 'month', amount: usd(49) }),
  meters: [
    included(ai.models['anthropic/claude-opus-5'].output, 200_000, {
      limit: 'hard',
    }),
    included(ai.models['anthropic/claude-sonnet-5'].output, 2_000_000, {
      limit: 'soft',
    }),
    ...ai.meters,
  ],
})

// Mode 2: actual cost from Vercel AI Gateway plus a margin.
export const plus = llm({
  gateway: vercelGateway(),
  key: 'plus',
  models,
  billing: costPlus({ markup: percent(40) }),
  tags: tags<{ feature: string }>(),
})
export const plusPro = product('plus_pro', {
  name: 'Plus',
  price: recurring({ interval: 'month', amount: usd(29) }),
  meters: [included(plus.spend, 20, { limit: 'hard' })],
})

// Mode 3: credits.
export const wallet = llm({
  gateway: vercelGateway(),
  key: 'wallet',
  models,
  billing: inCredits({
    rates: {
      'anthropic/claude-opus-5': perThousandOutput(10),
      'anthropic/claude-sonnet-5': perThousandOutput(3),
      'anthropic/claude-haiku-4-5': perThousandOutput(1),
      other: perCall(5),
    },
  }),
  tags: tags<{ feature: string }>(),
})
export const walletPro = product('wallet_pro', {
  name: 'Wallet',
  price: recurring({ interval: 'month', amount: usd(19) }),
  meters: [included(wallet.credits, 10_000, { limit: 'hard' })],
})

// One app picks one. All three are here so the shapes can be compared.
export const config = defineConfig({
  schema: { ai, pro, plus, plusPro, wallet, walletPro },
})

// ---- runtime ----------------------------------------------------------------

export async function program() {
  const apiUrl = '...'
  const token = '...'

  const void_ = createVoid(config, { apiUrl, token })
  const user = void_.as('user_123') //the acting identity

  // Zero touch. run automatically runs generateText through that actors context and tracks identity
  await user.run(
    () =>
      generateText({
        model: 'anthropic/claude-sonnet-5',
        prompt: 'Summarize this quarter.',
      }),
    { feature: 'summaries' }, //connect to tags
  )

  const gated = user.wallet.model('anthropic/claude-sonnet-5', {
    tags: { feature: 'chat' },
    gate: 'block', // or 'warn' / 'off'
    allow: async ({ check, estimate }) => {
      // allow or disallow the call to be made
      const verdict = await check({
        maxOutputTokens: Math.min(estimate.maxOutputTokens, 2_000),
      })
      return verdict.allowed
    },
    onDenied: ({ check }) =>
      console.warn(`out of ${check?.unit}: ${check?.remaining} left`),
    onEnd: ({ completion }) =>
      console.log(`spent ${completion.credits} credits`),
  })
  const stream = streamText({ model: gated, prompt: 'Tell me a story.' })
  for await (const delta of stream.textStream) console.log(delta)

  const chat = { feature: 'chat' }
  const ladder = fallback(
    [
      user.wallet.model('anthropic/claude-opus-5', {
        tags: chat,
        minRemaining: 100,
      }),
      user.wallet.model('anthropic/claude-sonnet-5', {
        tags: chat,
        minRemaining: 50,
      }),
      user.wallet.model('anthropic/claude-haiku-4-5', {
        tags: chat,
        gate: 'warn',
      }),
    ],
    {
      onFallback: ({ to, skipped }) =>
        console.log(
          `falling back to ${to}, skipped ${skipped.map((s) => s.model).join(', ')}`,
        ),
    },
  )
  const { text } = await generateText({
    model: ladder,
    prompt: 'Plan my week.',
  })
  console.log(text)

  // adds credit too wallet
  await user.wallet.grant(500, { reason: 'referral' })

  const snapshot = await user.snapshot()
  console.log('cost of goods', snapshot.meters.wallet.cost)
  console.log('credits', snapshot.meters.wallet.credits)
  console.log('spend', snapshot.meters.plus.spend)
  console.log(
    'opus output',
    snapshot.meters.ai.models['anthropic/claude-opus-5'].output,
  )
  await void_.dispose()
}
