/**
 * Void in one file: a pricing config, an app client, and a demo use case.
 *
 * Nothing here runs anywhere. It shows how the three pieces fit together for
 * a team that bills AI agents by token, caps each seat, and throttles an agent
 * that is burning tokens on retries instead of progress.
 *
 * In a real app the config lives in `void.ts` (what `void deploy` reads), the
 * client in your server code, and the use case wherever you call the model.
 */

import {
  createVoid,
  defineConfig,
  event,
  included,
  meter,
  product,
  recent,
  recurring,
  signal,
  sum,
  usd,
} from '../src/index'

// ---------------------------------------------------------------------------
// 1. Config: what gets deployed to Polar.
// ---------------------------------------------------------------------------

/** One completion from any provider, recorded by the app after each call. */
export const completion = event<{
  model: string
  input_tokens: number
  output_tokens: number
  tools?: string[]
  tool_errors?: string[]
  finish_reason?: string
}>('llm.completion')

/** Output tokens billed per unit. The reducer says what to sum, the price says what it costs. */
export const tokens = meter('output_tokens', {
  reducer: sum(completion, 'output_tokens'),
  price: usd(0.00002),
})

/** Team plan: a flat fee with a hard monthly allowance of output tokens. */
export const team = product('team', {
  name: 'Team',
  description: '2M output tokens a month for the whole workspace.',
  price: recurring({ interval: 'month', amount: usd(99) }),
  meters: [included(tokens, 2_000_000, { limit: 'hard' })],
})

/**
 * A meter signal: latch when the workspace has under 100k tokens left,
 * release once a top-up or a new period brings it back over 250k.
 */
export const runningLow = signal('running-low', {
  meter: tokens,
  field: 'remaining',
  enter: { below: 100_000 },
  exit: { atLeast: 250_000 },
})

/**
 * A semantic signal: Polar asks Jev this question about the identity's last
 * hour of completions on this meter and returns a noul in [0, 1]. The SDK
 * latches it. The question stays here in code; it is not deployed and does
 * not change the billing version.
 */
export const retryStorm = signal('retry-storm', {
  meter: tokens,
  when: 'most recent spend is retries or loops, not progress',
  over: recent(1, 'hour'),
  enter: { above: 0.7 },
  exit: { below: 0.4 },
})

export const config = defineConfig({
  schema: { completion, tokens, team, runningLow, retryStorm },
  signalRefreshInterval: 15_000,
})

// ---------------------------------------------------------------------------
// 2. App: one client for the process, scoped per identity when acting.
// ---------------------------------------------------------------------------

export const void_ = createVoid(config, {
  apiUrl: process.env.VOID_API_URL ?? 'https://api.polar.sh',
  token: process.env.VOID_TOKEN ?? '',
})

/** Identities form a tree: the workspace pays, members and agents spend against it. */
export const onboardWorkspace = async (workspaceId: string, email: string) => {
  await void_.api.customers.create({ external_id: workspaceId, email })
  const workspace = void_.as(workspaceId)
  await workspace.products.team.subscribe()
  return workspace
}

export const addAgent = (memberId: string, agentId: string) =>
  void_.as(memberId).spawn(agentId)

// ---------------------------------------------------------------------------
// 3. Use case: an agent loop that checks budget, records spend, and downgrades
//    itself when Jev says the spend is retries rather than progress.
// ---------------------------------------------------------------------------

const MODELS = {
  default: 'anthropic/claude-sonnet-5',
  cheaper: 'anthropic/claude-haiku-4-5',
} as const

/** Stand-in for the provider call. Returns what any LLM SDK reports back. */
const callModel = async (model: string, prompt: string) => ({
  text: `(${model}) ${prompt.slice(0, 20)}...`,
  usage: { input_tokens: 1_200, output_tokens: 350 },
  tools: ['search'],
  tool_errors: [] as string[],
  finish_reason: 'stop',
})

export const runAgentStep = async (agentId: string, prompt: string) => {
  const agent = void_.as(agentId)

  // Preflight against the workspace's remaining allowance. `check` rolls the
  // agent's usage up the identity chain to whoever holds the subscription.
  const budget = await agent.meters.tokens.check({ estimate: 500 })
  if (!budget.allowed) {
    throw new Error(`out of tokens: ${budget.reason} (${budget.limitedBy})`)
  }

  // Ask the semantic signal before picking a model. `get()` asks Polar for the
  // latest judgment; Polar only asks Jev when the last hour actually changed.
  const storm = await agent.signals.retryStorm.get()
  const model = storm.status === 'active' ? MODELS.cheaper : MODELS.default

  const reply = await callModel(model, prompt)

  // One event per completion. Everything Jev will later reason about is in
  // the metadata: model, tokens, which tools ran, which failed.
  await agent.events.completion.record({
    model,
    input_tokens: reply.usage.input_tokens,
    output_tokens: reply.usage.output_tokens,
    tools: reply.tools,
    tool_errors: reply.tool_errors,
    finish_reason: reply.finish_reason,
  })

  return { reply: reply.text, model, storming: storm.status === 'active' }
}

/**
 * Long-running processes listen instead of polling. Both signals share one
 * refresh loop per identity; handlers fire on transitions only.
 */
export const watchWorkspace = (workspaceId: string) => {
  const workspace = void_.as(workspaceId)

  const low = workspace.signals.runningLow.listen((state) => {
    if (state.transition === 'entered')
      notify(workspaceId, 'tokens running low')
    if (state.transition === 'exited')
      notify(workspaceId, 'token budget restored')
  })

  const storm = workspace.signals.retryStorm.listen((state) => {
    if (state.status === 'unknown') return
    // `evidence` is what Jev saw: event count, totals, distinct tool names.
    const seen = state.evidence?.events ?? 0
    if (state.transition === 'entered')
      notify(workspaceId, `retry storm (noul ${state.noul}, ${seen} calls)`)
  })

  return () => {
    low.close()
    storm.close()
  }
}

const notify = (workspaceId: string, message: string) =>
  console.log(`[${workspaceId}] ${message}`)

// ---------------------------------------------------------------------------
// Walkthrough, as it would read in a script.
// ---------------------------------------------------------------------------

export const demo = async () => {
  const workspace = await onboardWorkspace('acme', 'billing@acme.example')
  const member = await workspace.spawn('alice')
  const agent = await member.spawn('alice/deploy-bot')

  const stop = watchWorkspace('acme')
  for (const prompt of ['ship it', 'ship it again', 'why did that fail']) {
    const step = await runAgentStep(agent.id, prompt)
    console.log(step.model, step.storming ? '(throttled)' : '', step.reply)
  }
  stop()
  await void_.dispose()
}
