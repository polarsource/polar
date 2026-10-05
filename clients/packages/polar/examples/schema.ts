import { count, event, meter, on, oneOf, sum, usd } from '../src/index'

export const llmCompletion = event<{
  model: string
  input_tokens: number
  output_tokens: number
}>('llm.completion')
export const toolCall = event('tool.call')
export const searchQuery = event('search.query')

export const inputTokens = meter('input_tokens', {
  name: 'Input tokens',
  unit: 'token',
  usage: sum(llmCompletion, 'input_tokens'),
  price: usd(0.00015),
})

export const premiumOutputTokens = meter('premium_output_tokens', {
  name: 'Premium output tokens',
  unit: 'token',
  usage: sum(
    on(llmCompletion, { model: oneOf('claude-opus-5-5', 'claude-fable-5-1') }),
    'output_tokens',
  ),
  price: usd(0.0006),
})

export const toolCalls = meter('tool_calls', {
  name: 'Tool calls',
  usage: count(toolCall),
  price: usd(0.04),
})

export const searchRequests = meter('search_requests', {
  name: 'Search requests',
  unit: 'custom',
  customLabel: 'request',
  customMultiplier: 1000,
  usage: count(searchQuery),
  price: usd(0.0005),
})
