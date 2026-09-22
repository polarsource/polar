import type { Lesson } from '@/lesson/types'
import { BillingModes } from '@/scenes/BillingModes'
import { ConfigToIr } from '@/scenes/ConfigToIr'
import {
  costPlusCharge,
  creditsExact,
  creditsFor,
  estimateInputTokens,
  ladder,
  listCost,
  perTokenCharge,
} from '@/scenes/llm'
import { LlmPipeline, type Call } from '@/scenes/LlmPipeline'
import {
  checksumOf,
  compile,
  defineConfig,
  included,
  product,
  recurring,
  usd,
  type Config,
} from '@void/sdk/config'
import {
  costPlus,
  inCredits,
  llm,
  perCall,
  perThousand,
  perToken,
  percent,
  vercelGateway,
} from '@void/sdk/plugins'
import { code } from './code'

export const MODELS = [
  'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4-5',
] as const
export const RATES = {
  'anthropic/claude-sonnet-5': perThousand({ input: 3, output: 15 }),
  'anthropic/claude-haiku-4-5': perThousand({ input: 1, output: 5 }),
  other: perCall(5),
}
/** USD per token, the list the credit rates are priced against. */
export const LIST = {
  'anthropic/claude-sonnet-5': { input: usd(0.000003), output: usd(0.000015) },
  'anthropic/claude-haiku-4-5': { input: usd(0.000001), output: usd(0.000005) },
  other: { input: usd(0.000004), output: usd(0.00002) },
}
export const PER_TOKEN_MARKUP = 30
export const COST_PLUS_MARKUP = 40

export const tokens = llm({
  key: 'tokens',
  models: MODELS,
  gateway: vercelGateway(),
  billing: perToken(LIST, { markup: percent(PER_TOKEN_MARKUP) }),
})
export const plus = llm({
  key: 'plus',
  models: MODELS,
  gateway: vercelGateway(),
  billing: costPlus({ markup: percent(COST_PLUS_MARKUP) }),
})

const plugin = (classify: boolean) =>
  llm({
    key: 'assistant',
    models: MODELS,
    gateway: vercelGateway(),
    billing: inCredits({ rates: RATES }),
    capture: false,
    classify,
  })

export const ai = plugin(false)
const classified = plugin(true)
export const team = product('team', {
  name: 'Team',
  price: recurring({ interval: 'month', amount: usd(99) }),
  meters: [included(ai.credits, 100_000, { limit: 'hard' })],
})

export const stages: Record<'plugin' | 'product' | 'classified', Config> = {
  plugin: defineConfig({ schema: { ai } }),
  product: defineConfig({ schema: { ai, team } }),
  classified: defineConfig({
    schema: {
      ai: classified,
      team: product('team', {
        name: 'Team',
        price: recurring({ interval: 'month', amount: usd(99) }),
        meters: [included(classified.credits, 100_000, { limit: 'hard' })],
      }),
    },
  }),
}

/** One call, with the numbers the plugin would produce for it. */
const PROMPT_CHARS = 1_840
const inputTokens = estimateInputTokens(PROMPT_CHARS)
const sonnet = RATES['anthropic/claude-sonnet-5']
const usage = { input: inputTokens, output: 812 }
const sonnetList = LIST['anthropic/claude-sonnet-5']
const tokenBill = perTokenCharge(
  { input: sonnetList.input.amount, output: sonnetList.output.amount },
  usage,
  PER_TOKEN_MARKUP,
)
const gatewayCost = listCost({ input: 3, output: 15 }, usage)
const plusBill = costPlusCharge(gatewayCost, COST_PLUS_MARKUP)
const exactCredits = creditsExact(sonnet, usage)

const n = (value: number) => value.toLocaleString('en-US')
const money = (value: number) => {
  const digits = Math.abs(value) >= 0.01 ? 6 : 10
  return `$${value.toFixed(digits).replace(/0+$/, '')}`
}
export const call: Call = {
  identity: 'nightly',
  model: 'anthropic/claude-sonnet-5',
  tags: { feature: 'chat' },
  estimate: {
    inputTokens,
    maxOutputTokens: 4096,
    credits: creditsFor(sonnet, { input: inputTokens, output: 4096 }),
  },
  remaining: 120,
  usage,
  credits: creditsFor(sonnet, usage),
  cost: gatewayCost,
  callId: 'call_8f2a',
}
const short = { ...call, remaining: 40 }
export const tiers = ladder(
  [
    { model: 'anthropic/claude-sonnet-5', rate: sonnet },
    {
      model: 'anthropic/claude-haiku-4-5',
      rate: RATES['anthropic/claude-haiku-4-5'],
    },
  ],
  { input: inputTokens, maxOutput: 4096 },
  short.remaining,
)

const VOID_PLUGIN = `import { llm, inCredits, perCall, perThousand, vercelGateway } from '@void/sdk/plugins'

export const ai = llm({
  key: 'assistant',
  models: ['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4-5'],
  gateway: vercelGateway(),
  billing: inCredits({
    rates: {
      'anthropic/claude-sonnet-5': perThousand({ input: 3, output: 15 }),
      'anthropic/claude-haiku-4-5': perThousand({ input: 1, output: 5 }),
      other: perCall(5),
    },
  }),
})
`

const BILLING = `import { usd } from '@void/sdk'
import { costPlus, inCredits, perCall, perThousand, perToken, percent } from '@void/sdk/plugins'

// list price per token; the markup is part of the meter price
billing: perToken(
  {
    'anthropic/claude-sonnet-5': { input: usd(0.000003), output: usd(0.000015) },
    'anthropic/claude-haiku-4-5': { input: usd(0.000001), output: usd(0.000005) },
    other: { input: usd(0.000004), output: usd(0.00002) },
  },
  { markup: percent(30) },
)

// the meter sums gateway cost; each dollar is priced at the markup
billing: costPlus({ markup: percent(40) })

// a rate per model, taken from a pool and rounded up
billing: inCredits({
  rates: {
    'anthropic/claude-sonnet-5': perThousand({ input: 3, output: 15 }),
    'anthropic/claude-haiku-4-5': perThousand({ input: 1, output: 5 }),
    other: perCall(5),
  },
})
`

const VOID_PRODUCT = `import { included, product, recurring, usd } from '@void/sdk'
import { llm, inCredits, perCall, perThousand, vercelGateway } from '@void/sdk/plugins'

export const ai = llm({
  key: 'assistant',
  models: ['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4-5'],
  gateway: vercelGateway(),
  billing: inCredits({
    rates: {
      'anthropic/claude-sonnet-5': perThousand({ input: 3, output: 15 }),
      'anthropic/claude-haiku-4-5': perThousand({ input: 1, output: 5 }),
      other: perCall(5),
    },
  }),
})

export const team = product('team', {
  name: 'Team',
  price: recurring({ interval: 'month', amount: usd(99) }),
  meters: [included(ai.credits, 100_000, { limit: 'hard' })],
})
`

const ROUTE = `import { streamText } from 'ai'
import { client } from './client'

export const POST = async (request: Request) => {
  const { agentId, messages } = await request.json()

  const result = streamText({
    model: client.as(agentId).ai.model('anthropic/claude-sonnet-5', {
      tags: { feature: 'chat' },
      gate: 'block',
    }),
    messages,
  })

  return result.toUIMessageStreamResponse()
}
`

const HOOKS = `const model = client.as(agentId).ai.model('anthropic/claude-sonnet-5', {
  tags: { feature: 'chat' },
  gate: 'block', // 'warn' logs and proceeds, 'off' skips the check
  allow: async (call) => {
    // call.estimate, call.params; return false to veto after the gate
    return await withinTeamHours()
  },
  onEnd: ({ completion }) => publish({ credits: completion.credits }),
  onDenied: ({ check, by }) => log.warn('denied', by, check?.reason),
})
`

const DENIED = `${HOOKS}
// nightly's chain has 40 credits left; the estimate needs 63.
// The gate throws before the provider is called:
//   VoidError { reason: 'denied', message: 'llm: anthropic/claude-sonnet-5 denied by gate for nightly (cap)' }
`

const LADDER = `import { fallback } from '@void/sdk/plugins'

const agent = client.as(agentId)

const model = fallback(
  [
    agent.ai.model('anthropic/claude-sonnet-5', { minRemaining: 50 }),
    agent.ai.model('anthropic/claude-haiku-4-5'),
  ],
  { onFallback: ({ to, skipped }) => log.info('fell back to', to, skipped) },
)

const result = streamText({ model, messages })
// The completion records model: haiku, fallback_from: sonnet
`

const CAPTURE = `// void.ts: capture is on by default; this is what \`capture: false\` turned off
export const ai = llm({ key: 'assistant', models, gateway, billing })

// anywhere in the process, a plain AI SDK call inside a run is recorded too
await client.as(agentId).run(
  async () => {
    const { text } = await generateText({
      model: 'anthropic/claude-sonnet-5',
      prompt,
    })
  },
  { feature: 'summary' },
)
// recorded as agentId with feature: summary, once, even if the model was wrapped
`

const CLASSIFY = `export const ai = llm({
  key: 'assistant',
  models: ['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4-5'],
  gateway: vercelGateway(),
  billing: inCredits({ rates }),
  classify: true, // or { span: 'conversation_id' }
})
`

const ACTIVITIES = `const report = await client.api.activities.list()
report.totals // { cost, labeled_cost, unlabeled_cost, pending_cost }
report.by_activity // [{ slug: 'retry', cost, share, spans, waste_cost }, …]

const span = await client.api.activities.span('call_8f2a')
span.activity // 'retry', once Jev has looked; 'pending' before
`

const spansPending = [
  {
    key: 'call_8f2a',
    activity: 'pending',
    cost: call.cost!,
    waste: null,
    due: 'in 1s',
  },
  {
    key: 'call_7c10',
    activity: 'implement',
    cost: 0.0412,
    waste: 0,
    due: null,
  },
  { key: 'call_6b9e', activity: 'plan', cost: 0.0088, waste: 0, due: null },
]
const spansLabelled = [
  {
    key: 'call_8f2a',
    activity: 'retry',
    cost: call.cost!,
    waste: 0.8,
    due: null,
  },
  ...spansPending.slice(1),
]
const report = {
  totals: { cost: 0.31, labeled: 0.29, pending: 0.02 },
  byActivity: [
    { slug: 'implement', cost: 0.14, waste: 0 },
    { slug: 'retrieve', cost: 0.06, waste: 0 },
    { slug: 'plan', cost: 0.04, waste: 0 },
    { slug: 'retry', cost: 0.05, waste: 0.04 },
  ],
}

export const llmLesson: Lesson = {
  slug: 'llm',
  title: 'LLM plugin',
  summary: 'Meter and gate every model call with the AI SDK.',
  file: 'void.ts',
  steps: [
    {
      id: 'plugin',
      prose: (
        <>
          <p>
            A plugin is a bundle of definitions with verbs attached.{' '}
            {code('llm')} declares a completion event, a pair of token reducers
            per named model plus a pair for everything else, and whatever its
            billing mode needs: here a credits meter and the granted event that
            tops it up.
          </p>
          <p>
            Three modes: {code('perToken')} bills tokens at a price,{' '}
            {code('costPlus')} bills what the gateway charged plus a markup,{' '}
            {code('inCredits')} converts each call to credits from a pool. This
            one is credits: a rate per model, rounded up.
          </p>
        </>
      ),
      code: VOID_PLUGIN,
      focus: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      scene: (
        <ConfigToIr
          ir={compile(stages.plugin)}
          checksum={checksumOf(stages.plugin)}
        />
      ),
    },
    {
      id: 'billing',
      prose: (
        <>
          <p>
            The mode changes the bill, not the record. This call is{' '}
            {usage.input.toLocaleString('en-US')} input tokens and{' '}
            {usage.output.toLocaleString('en-US')} output on Sonnet. The gateway
            reports {money(gatewayCost)}.
          </p>
          <p>
            {code('inCredits')} converts at the model&apos;s rate and rounds{' '}
            {exactCredits} up to {creditsFor(sonnet, usage)}. {code('costPlus')}{' '}
            records the gateway cost on a spend meter priced at{' '}
            {code('percent(40)')}: the allowance is dollars of provider cost,
            and the customer pays the marked-up amount. {code('perToken')}{' '}
            charges each token at list price times {code('percent(30)')}, so the
            markup sits in the meter price.
          </p>
        </>
      ),
      code: BILLING,
      focus: [5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 19, 20, 21, 22, 23, 24, 25],
      scene: (
        <BillingModes
          model={call.model}
          input={usage.input}
          output={usage.output}
          gatewayCost={money(gatewayCost)}
          modes={[
            {
              id: 'inCredits',
              caption: 'rate, round up',
              chapter: true,
              lines: [
                `${n(usage.input)} × 3`,
                `${n(usage.output)} × 15`,
                `exact ${exactCredits}`,
              ],
              total: String(creditsFor(sonnet, usage)),
              unit: 'credits',
              meter: 'assistant-credits',
            },
            {
              id: 'costPlus',
              caption: 'gateway × markup',
              lines: [
                `cost ${money(gatewayCost)}`,
                `× ${plusBill.factor.toFixed(2)}`,
              ],
              total: money(plusBill.total),
              unit: 'usd',
              meter: 'plus-spend',
            },
            {
              id: 'perToken',
              caption: 'list × 1.30',
              lines: [
                `${n(usage.input)} × ${money(tokenBill.inputPrice)}`,
                `${n(usage.output)} × ${money(tokenBill.outputPrice)}`,
              ],
              total: money(tokenBill.total),
              unit: 'usd',
              meter: 'input + output',
            },
          ]}
        />
      ),
    },
    {
      id: 'product',
      prose: (
        <>
          <p>
            The plugin&apos;s meters are ordinary meters. {code('ai.credits')}{' '}
            goes on a product like any other, so Team includes a hundred
            thousand credits a month and denies past them.
          </p>
          <p>
            The gateway decides where cost of goods comes from and how a bare
            model id resolves. {code('direct()')} is the default and reports no
            cost; cost-plus billing needs {code('vercelGateway()')} or{' '}
            {code('openrouter()')}.
          </p>
        </>
      ),
      code: VOID_PRODUCT,
      focus: [17, 18, 19, 20, 21],
      scene: (
        <ConfigToIr
          ir={compile(stages.product)}
          checksum={checksumOf(stages.product)}
        />
      ),
    },
    {
      id: 'model',
      prose: (
        <>
          <p>
            At runtime an identity&apos;s scope has the plugin&apos;s verbs.{' '}
            {code('ai.model')} returns the same model, metered as that identity:
            it drops into {code('streamText')} unchanged.
          </p>
          <p>
            Before the provider is called, the gate estimates the call: four
            characters per input token, {code('maxOutputTokens')} for the
            output, converted to credits at the model&apos;s rate, and checked
            against every holder up the chain.
          </p>
        </>
      ),
      code: ROUTE,
      file: 'route.ts',
      focus: [8, 9, 10, 11],
      scene: <LlmPipeline stage="gate" call={call} />,
    },
    {
      id: 'gateway',
      prose: (
        <>
          <p>
            Allowed, the call goes upstream. The gateway stamps the identity and
            the tags onto the request, so Vercel&apos;s own reporting groups
            spend the way Void does.
          </p>
          <p>
            The provider answers with the usage it counted and, through the
            gateway, the dollar cost of the call. The estimate was only ever for
            the gate.
          </p>
        </>
      ),
      focus: [8, 9, 10, 11],
      scene: <LlmPipeline stage="provider" call={call} />,
    },
    {
      id: 'record',
      prose: (
        <>
          <p>
            One completion event is recorded as the identity: model, tokens, the
            credits the rate converts them to, the cost and where it came from,
            and the {code('call_id')} that groups the steps of one call.
          </p>
          <p>
            From there it is the identities chapter again: the credits fold into
            nightly, alice and acme, and the next check sees them.
          </p>
        </>
      ),
      focus: [8, 9, 10, 11],
      scene: <LlmPipeline stage="record" call={call} />,
    },
    {
      id: 'hooks',
      prose: (
        <>
          <p>
            The wrapper takes hooks. {code('gate')} chooses what a failed check
            does; {code('allow')} runs after the gate and can veto with its own
            reasons; {code('onEnd')} sees the recorded completion;{' '}
            {code('onDenied')} sees every denial.
          </p>
          <p>
            With 40 credits left and an estimate of 63, a blocking gate throws a{' '}
            {code('VoidError')} with {code("reason: 'denied'")} before the
            provider is ever called. Nothing is recorded.
          </p>
        </>
      ),
      code: DENIED,
      file: 'route.ts',
      focus: [3, 4, 5, 6, 7, 8, 9],
      scene: <LlmPipeline stage="gate" call={short} denied />,
    },
    {
      id: 'ladder',
      prose: (
        <>
          <p>
            {code('fallback')} turns several metered models into one. Each call
            runs the first tier whose check allows it with{' '}
            {code('minRemaining')} to spare; when none does, the last tier runs
            and its own gate decides.
          </p>
          <p>
            Sonnet needs 63 of the 40 left, so Haiku runs at 21. The completion
            records which tier ran and {code('fallback_from')}.
          </p>
        </>
      ),
      code: LADDER,
      file: 'route.ts',
      focus: [5, 6, 7, 8, 9, 10, 11],
      scene: (
        <LlmPipeline
          stage="record"
          call={{
            ...short,
            model: 'anthropic/claude-haiku-4-5',
            credits: creditsFor(RATES['anthropic/claude-haiku-4-5'], usage),
            cost: listCost({ input: 1, output: 5 }, usage),
            estimate: { ...short.estimate, credits: tiers[1]!.estimate },
          }}
          tiers={tiers}
        />
      ),
    },
    {
      id: 'capture',
      prose: (
        <>
          <p>
            Wrapping is optional. By default {code('createVoid')} hooks the AI
            SDK&apos;s telemetry for the plugin, so every model call in the
            process is recorded as whoever is ambient, with the run&apos;s tags.
            Only {code('capture: false')} turns that off.
          </p>
          <p>
            A step a wrapped model already recorded is skipped, so the two paths
            coexist without double counting. Capture cannot gate, since it only
            sees a call once it has finished.
          </p>
        </>
      ),
      code: CAPTURE,
      file: 'summary.ts',
      focus: [5, 6, 7, 8, 9, 10, 11, 12],
      scene: (
        <LlmPipeline
          stage="record"
          call={{ ...call, tags: { feature: 'summary' }, callId: 'call_9d01' }}
          captured
        />
      ),
    },
    {
      id: 'classify',
      prose: (
        <>
          <p>
            {code('classify: true')} asks Polar to label what each call was for.
            The plugin adds an activity entry to the deployment, grouping
            completions by {code('call_id')} into spans.
          </p>
          <p>
            A span&apos;s own row is its job: ingest sets a due time, a sweep
            classifies every span that is due. Labels come a few seconds after
            the call, not with it, and they never move money.
          </p>
        </>
      ),
      code: CLASSIFY,
      focus: [6],
      scene: <LlmPipeline stage="record" call={call} spans={spansPending} />,
    },
    {
      id: 'activities',
      prose: (
        <>
          <p>
            Jev reads the span and labels it plan, retrieve, implement, act,
            review or retry, with a waste score for spend that did not move the
            task on. This call was a retry.
          </p>
          <p>
            {code('activities.list()')} folds the labels into a report: cost by
            activity, its share, and the waste, so an identity&apos;s spend can
            be explained, not only counted.
          </p>
        </>
      ),
      code: ACTIVITIES,
      file: 'report.ts',
      focus: [1, 2, 3],
      scene: (
        <LlmPipeline
          stage="record"
          call={call}
          spans={spansLabelled}
          report={report}
        />
      ),
    },
  ],
}
