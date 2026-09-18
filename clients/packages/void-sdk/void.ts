// Pulled from Polar Void: v3 6f89ef6084d96b56a894777db9f23a3ae3d46873ea8bae95baffe4a20d424014 (active).
// Best effort: meter names, plugins, signals and event storage are not part
// of the deployed configuration. Review any TODO before deploying.

import {
  count,
  defineConfig,
  entitlement,
  event,
  included,
  meter,
  product,
  recurring,
  sum,
  usd,
} from '@void/sdk/config'

export const llmCompletion = event<{
  input_tokens: number
  output_tokens: number
}>('llm.completion')

export const sandboxStopped = event<{ minutes: number }>('sandbox.stopped')

export const toolCall = event('tool.call')

export const inputTokens = meter('input_tokens', {
  reducer: sum(llmCompletion, 'input_tokens'),
  price: usd(0.00015),
})

export const outputTokens = meter('output_tokens', {
  reducer: sum(llmCompletion, 'output_tokens'),
  price: usd(0.0008),
})

export const sandboxMinutes = meter('sandbox_minutes', {
  reducer: sum(sandboxStopped, 'minutes'),
  price: usd(0.02),
})

export const toolCalls = meter('tool_calls', {
  reducer: count(toolCall),
  price: usd(0.04),
})

export const analytics = entitlement('analytics', { name: 'Usage analytics' })

export const apiAccess = entitlement('api-access', { name: 'API access' })

export const prioritySupport = entitlement('priority-support', {
  name: 'Priority support',
})

export const sandbox = entitlement('sandbox', { name: 'Sandboxes' })

export const scale = product('scale', {
  name: 'Scale',
  description: 'For production agents, 25k output tokens included.',
  price: recurring({ interval: 'month', amount: usd(499) }),
  meters: [
    inputTokens,
    included(outputTokens, 25000, { limit: 'soft' }),
    sandboxMinutes,
    toolCalls,
  ],
  entitlements: [analytics, apiAccess, prioritySupport, sandbox],
})

export const starter = product('starter', {
  name: 'Starter',
  description: 'Pay as you go for individuals.',
  price: recurring({ interval: 'month', amount: usd(19) }),
  meters: [inputTokens, outputTokens, toolCalls],
  entitlements: [apiAccess],
})

export const team = product('team', {
  name: 'Team',
  description: 'Shared workspace with 5k output tokens included.',
  price: recurring({ interval: 'month', amount: usd(99) }),
  meters: [
    inputTokens,
    included(outputTokens, 5000, { limit: 'soft' }),
    sandboxMinutes,
    toolCalls,
  ],
  entitlements: [analytics, apiAccess, sandbox],
})

export const config = defineConfig({
  schema: {
    llmCompletion,
    sandboxStopped,
    toolCall,
    inputTokens,
    outputTokens,
    sandboxMinutes,
    toolCalls,
    analytics,
    apiAccess,
    prioritySupport,
    sandbox,
    scale,
    starter,
    team,
  },
})
