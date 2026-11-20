import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider'
import { type LanguageModelMiddleware, wrapLanguageModel } from 'ai'
import * as Schema from 'effect/Schema'
import type { IngestionContext } from '../../ingestion'
import {
  type IngestionExecutionHandler,
  IngestionStrategy,
  type IngestionStrategyCustomer,
  type IngestionStrategyExternalCustomer,
} from '../../strategy'
import type { models } from '@polar-sh/sdk/2027-01'

const LLMUsage = {
  inputTokens: Schema.Finite,
  outputTokens: Schema.Finite,
  totalTokens: Schema.Finite,
  cachedInputTokens: Schema.Finite,
  vendor: Schema.String,
  model: Schema.String,
}

export const LLMStrategyContext = Schema.toStandardSchemaV1(
  Schema.Struct({
    ...LLMUsage,
    strategy: Schema.Literal('LLM'),
    _llm: Schema.Struct(LLMUsage),
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

export class LLMStrategy extends IngestionStrategy<
  LLMStrategyContext,
  LanguageModelV2
> {
  private model: LanguageModelV2

  constructor(model: LanguageModelV2) {
    super()

    this.model = model
  }

  private middleware(
    execute: IngestionExecutionHandler<LLMStrategyContext>,
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): LanguageModelMiddleware {
    const wrapGenerate = async (options: {
      doGenerate: () => ReturnType<LanguageModelV2['doGenerate']>
      params: LanguageModelV2CallOptions
      model: LanguageModelV2
    }): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>> => {
      const result = await options.doGenerate()

      const llmEvent: LLMStrategyContext = {
        vendor: this.model.provider,
        model: this.model.modelId,
        inputTokens: result.usage.inputTokens ?? 0,
        cachedInputTokens: result.usage.cachedInputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
        strategy: 'LLM',
        _llm: {
          vendor: this.model.provider,
          model: this.model.modelId,
          inputTokens: result.usage.inputTokens ?? 0,
          cachedInputTokens: result.usage.cachedInputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
        },
      }

      await execute(llmEvent, customer)

      return result
    }

    const wrapStream = async ({
      doStream,
    }: {
      doStream: () => ReturnType<LanguageModelV2['doStream']>
      params: LanguageModelV2CallOptions
      model: LanguageModelV2
    }) => {
      const { stream, ...rest } = await doStream()

      const transformStream = new TransformStream<
        LanguageModelV2StreamPart,
        LanguageModelV2StreamPart
      >({
        transform: async (chunk, controller) => {
          if (chunk.type === 'finish') {
            const llmEvent: LLMStrategyContext = {
              vendor: this.model.provider,
              model: this.model.modelId,
              inputTokens: chunk.usage.inputTokens ?? 0,
              cachedInputTokens: chunk.usage.cachedInputTokens ?? 0,
              outputTokens: chunk.usage.outputTokens ?? 0,
              totalTokens: chunk.usage.totalTokens ?? 0,
              strategy: 'LLM',
              _llm: {
                vendor: this.model.provider,
                model: this.model.modelId,
                inputTokens: chunk.usage.inputTokens ?? 0,
                cachedInputTokens: chunk.usage.cachedInputTokens ?? 0,
                outputTokens: chunk.usage.outputTokens ?? 0,
                totalTokens: chunk.usage.totalTokens ?? 0,
              },
            }

            await execute(llmEvent, customer)
          }

          controller.enqueue(chunk)
        },
      })

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      }
    }

    return {
      wrapGenerate,
      wrapStream,
    }
  }

  override client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): LanguageModelV2 {
    const executionHandler = this.createExecutionHandler()

    return wrapLanguageModel({
      model: this.model,
      middleware: this.middleware(executionHandler, customer),
    })
  }
}
