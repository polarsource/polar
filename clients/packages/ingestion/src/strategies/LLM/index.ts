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

const isBreakdown = Schema.is(TokenBreakdown)

const total = (tokens: TokenCount) =>
  (isBreakdown(tokens) ? tokens.total : tokens) ?? 0

const cacheRead = (tokens: TokenCount) =>
  isBreakdown(tokens) ? tokens.cacheRead : undefined

export class LLMStrategy<
  TModel extends LLMStrategyModel = LLMStrategyModel,
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
      vendor: this.model.provider,
      model: this.model.modelId,
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
    const ingest = (usage: Usage) => execute(this.context(usage), customer)

    return new Proxy(this.model, {
      get: (model, property) => {
        if (property === 'doGenerate') {
          return async (options: never) => {
            const result = await model.doGenerate(options)
            await ingest(result.usage)

            return result
          }
        }

        if (property === 'doStream') {
          return async (options: never) => {
            const { stream, ...rest } = await model.doStream(options)

            return {
              ...rest,
              stream: stream.pipeThrough(
                new TransformStream({
                  transform: async (chunk, controller) => {
                    if (chunk.type === 'finish' && chunk.usage) {
                      await ingest(chunk.usage)
                    }

                    controller.enqueue(chunk)
                  },
                }),
              ),
            }
          }
        }

        // Read with the model as receiver so getters and private fields work
        const value = Reflect.get(model, property, model)

        return typeof value === 'function' ? value.bind(model) : value
      },
    })
  }
}
