import * as Schema from 'effect/Schema'
import type { Ingest, Usage } from './usage'

type TanStackChunk = { type: string; usage?: unknown }

export type LLMStrategyTanStackAI = {
  readonly kind: 'text'
  readonly name: string
  readonly provider?: string | undefined
  readonly model: string
  chatStream(options: never): AsyncIterable<TanStackChunk>
  structuredOutput(options: never): PromiseLike<{ usage?: unknown }>
  structuredOutputStream?(options: never): AsyncIterable<TanStackChunk>
}

export const isTanStackAI = (model: object): model is LLMStrategyTanStackAI =>
  'chatStream' in model

const isTanStackAIUsage = Schema.is(
  Schema.Struct({
    promptTokens: Schema.Number,
    completionTokens: Schema.Number,
    totalTokens: Schema.optional(Schema.Number),
    promptTokensDetails: Schema.optional(
      Schema.Struct({ cachedTokens: Schema.optional(Schema.Number) }),
    ),
  }),
)

// The AG-UI form of usage, one entry per model, which a run event may carry instead
const isAgUiUsage = Schema.is(
  Schema.Array(
    Schema.Struct({
      inputTokens: Schema.optional(Schema.Number),
      outputTokens: Schema.optional(Schema.Number),
      totalTokens: Schema.optional(Schema.Number),
      cachedInputTokens: Schema.optional(Schema.Number),
    }),
  ),
)

const tanStackAIUsage = (usage: unknown): Usage | undefined => {
  if (isTanStackAIUsage(usage)) {
    return {
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      cachedInputTokens: usage.promptTokensDetails?.cachedTokens,
    }
  }

  if (isAgUiUsage(usage) && usage.length > 0) {
    const sum = (key: keyof (typeof usage)[number]) =>
      usage.some((entry) => entry[key] !== undefined)
        ? usage.reduce((sum, entry) => sum + (entry[key] ?? 0), 0)
        : undefined

    return {
      inputTokens: sum('inputTokens'),
      outputTokens: sum('outputTokens'),
      totalTokens: sum('totalTokens'),
      cachedInputTokens: sum('cachedInputTokens'),
    }
  }

  return undefined
}

export const tanStackAIMethods = (
  adapter: LLMStrategyTanStackAI,
  ingest: Ingest,
) => {
  const identity = {
    vendor: adapter.provider ?? adapter.name,
    model: adapter.model,
  }

  // An adapter that fails after the provider answered throws with the billed usage
  const ingestAndRethrow = async (error: unknown): Promise<never> => {
    await ingest(
      identity,
      tanStackAIUsage((error as { usage?: unknown } | null)?.usage),
    )
    throw error
  }

  const meter = async function* (chunks: AsyncIterable<TanStackChunk>) {
    try {
      for await (const chunk of chunks) {
        if (chunk.type === 'RUN_FINISHED' || chunk.type === 'RUN_ERROR') {
          await ingest(identity, tanStackAIUsage(chunk.usage))
        }

        yield chunk
      }
    } catch (error) {
      await ingestAndRethrow(error)
    }
  }

  const { structuredOutputStream } = adapter

  return {
    chatStream: (options: never) => meter(adapter.chatStream(options)),
    structuredOutput: async (options: never) => {
      const result = await adapter
        .structuredOutput(options)
        .then(undefined, ingestAndRethrow)
      await ingest(identity, tanStackAIUsage(result.usage))

      return result
    },
    // Without it TanStack AI falls back to structuredOutput, which is metered
    ...(structuredOutputStream && {
      structuredOutputStream: (options: never) =>
        meter(structuredOutputStream.call(adapter, options)),
    }),
  }
}
