import * as Schema from 'effect/Schema'
import { type IngestionContext, LLMUsage } from '../../ingestion'
import {
  IngestionStrategy,
  type IngestionStrategyCustomer,
  type IngestionStrategyExternalCustomer,
} from '../../strategy'
import type { models } from '@polar-sh/sdk/2027-01'

export const LLMStrategyContext = Schema.toStandardSchemaV1(
  Schema.Struct({
    ...LLMUsage.fields,
    strategy: Schema.Literal('LLM'),
    _llm: LLMUsage,
    _cost: Schema.optionalKey(
      Schema.Struct({
        amount: Schema.Union([Schema.Finite, Schema.String]),
        currency: Schema.String,
      }),
    ),
  }),
)

export type LLMStrategyContext = IngestionContext<
  typeof LLMStrategyContext.Type
>

export type CostResolver = (
  context: LLMStrategyContext,
) => models.CostMetadataInput

const TokenBreakdown = Schema.Struct({
  total: Schema.optional(Schema.Number),
  cacheRead: Schema.optional(Schema.Number),
})

// AI SDK 5 reports plain numbers, 6 and later a breakdown per direction
type TokenCount = number | typeof TokenBreakdown.Type | undefined

type Usage = {
  inputTokens: TokenCount
  outputTokens: TokenCount
  totalTokens?: number | undefined
  cachedInputTokens?: number | undefined
}

// The part of an AI SDK language model the strategy reads, in any spec version
export type LLMStrategyModel = {
  readonly provider: string
  readonly modelId: string
  doGenerate(options: never): PromiseLike<{ usage: Usage }>
  doStream(options: never): PromiseLike<{
    stream: ReadableStream<{ type: string; usage?: Usage }>
  }>
}

type TanStackChunk = { type: string; usage?: unknown }

export type LLMStrategyAdapter = {
  readonly kind: 'text'
  readonly name: string
  readonly provider?: string | undefined
  readonly model: string
  chatStream(options: never): AsyncIterable<TanStackChunk>
  structuredOutput(options: never): PromiseLike<{ usage?: unknown }>
  structuredOutputStream?(options: never): AsyncIterable<TanStackChunk>
}

const isBreakdown = Schema.is(TokenBreakdown)

const total = (tokens: TokenCount) =>
  (isBreakdown(tokens) ? tokens.total : tokens) ?? 0

const cacheRead = (tokens: TokenCount) =>
  isBreakdown(tokens) ? tokens.cacheRead : undefined

const isTanStackUsage = Schema.is(
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
const isSpecUsage = Schema.is(
  Schema.Array(
    Schema.Struct({
      inputTokens: Schema.optional(Schema.Number),
      outputTokens: Schema.optional(Schema.Number),
      totalTokens: Schema.optional(Schema.Number),
      cachedInputTokens: Schema.optional(Schema.Number),
    }),
  ),
)

const tanStackUsage = (usage: unknown): Usage | undefined => {
  if (isTanStackUsage(usage)) {
    return {
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      cachedInputTokens: usage.promptTokensDetails?.cachedTokens,
    }
  }

  if (isSpecUsage(usage) && usage.length > 0) {
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

const isAdapter = (
  model: LLMStrategyModel | LLMStrategyAdapter,
): model is LLMStrategyAdapter => 'chatStream' in model

type Ingest = (usage: Usage | undefined) => Promise<void>

const modelMethods = (model: LLMStrategyModel, ingest: Ingest) => ({
  doGenerate: async (options: never) => {
    const result = await model.doGenerate(options)
    await ingest(result.usage)

    return result
  },
  doStream: async (options: never) => {
    const { stream, ...rest } = await model.doStream(options)

    return {
      ...rest,
      stream: stream.pipeThrough(
        new TransformStream({
          transform: async (chunk, controller) => {
            if (chunk.type === 'finish') {
              await ingest(chunk.usage)
            }

            controller.enqueue(chunk)
          },
        }),
      ),
    }
  },
})

const adapterMethods = (adapter: LLMStrategyAdapter, ingest: Ingest) => {
  const meter = async function* (chunks: AsyncIterable<TanStackChunk>) {
    for await (const chunk of chunks) {
      if (chunk.type === 'RUN_FINISHED') {
        await ingest(tanStackUsage(chunk.usage))
      }

      yield chunk
    }
  }

  const { structuredOutputStream } = adapter

  return {
    chatStream: (options: never) => meter(adapter.chatStream(options)),
    structuredOutput: async (options: never) => {
      const result = await adapter.structuredOutput(options)
      await ingest(tanStackUsage(result.usage))

      return result
    },
    // Without it TanStack AI falls back to structuredOutput, which is metered
    ...(structuredOutputStream && {
      structuredOutputStream: (options: never) =>
        meter(structuredOutputStream.call(adapter, options)),
    }),
  }
}

export class LLMStrategy<
  TModel extends LLMStrategyModel | LLMStrategyAdapter = LLMStrategyModel,
> extends IngestionStrategy<LLMStrategyContext, TModel> {
  private model: TModel

  constructor(model: TModel) {
    super()

    this.model = model
  }

  private context(usage: Usage): LLMStrategyContext {
    const inputTokens = total(usage.inputTokens)
    const outputTokens = total(usage.outputTokens)

    const llm = {
      ...(isAdapter(this.model)
        ? {
            vendor: this.model.provider ?? this.model.name,
            model: this.model.model,
          }
        : { vendor: this.model.provider, model: this.model.modelId }),
      inputTokens,
      cachedInputTokens:
        usage.cachedInputTokens ?? cacheRead(usage.inputTokens) ?? 0,
      outputTokens,
      totalTokens: usage.totalTokens ?? inputTokens + outputTokens,
    }

    return { ...llm, strategy: 'LLM', _llm: llm }
  }

  override client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): TModel {
    const execute = this.createExecutionHandler()
    const ingest = async (usage: Usage | undefined) => {
      if (usage) {
        await execute(this.context(usage), customer)
      }
    }

    const methods: Record<PropertyKey, unknown> = isAdapter(this.model)
      ? adapterMethods(this.model, ingest)
      : modelMethods(this.model, ingest)

    return new Proxy(this.model, {
      get: (model, property) => {
        if (Object.hasOwn(methods, property)) {
          return methods[property]
        }

        // Read with the model as receiver so getters and private fields work
        const value = Reflect.get(model, property, model)

        return typeof value === 'function' ? value.bind(model) : value
      },
    })
  }
}
