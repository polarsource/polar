import * as Schema from 'effect/Schema'
import { type IngestionContext, LLMUsage } from '../../ingestion'
import {
  IngestionStrategy,
  type IngestionStrategyCustomer,
  type IngestionStrategyExternalCustomer,
} from '../../strategy'
import type { models } from '@polar-sh/sdk/2027-01'
import { aiSdkMethods, type LLMStrategyAISDK } from './aiSdk'
import { isOpenAI, type LLMStrategyOpenAI, openAIClient } from './openai'
import {
  isTanStackAI,
  type LLMStrategyTanStackAI,
  tanStackAIMethods,
} from './tanstack'
import type { Identity, Usage } from './usage'

export type { LLMStrategyAISDK } from './aiSdk'
export type { LLMStrategyOpenAI } from './openai'
export type { LLMStrategyTanStackAI } from './tanstack'

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

const context = (identity: Identity, usage: Usage): LLMStrategyContext => {
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0

  const llm = {
    ...identity,
    inputTokens,
    cachedInputTokens: usage.cachedInputTokens ?? 0,
    outputTokens,
    totalTokens: usage.totalTokens ?? inputTokens + outputTokens,
  }

  return { ...llm, strategy: 'LLM', _llm: llm }
}

export class LLMStrategy<
  TModel extends LLMStrategyAISDK | LLMStrategyTanStackAI | LLMStrategyOpenAI =
    LLMStrategyAISDK,
> extends IngestionStrategy<LLMStrategyContext, TModel> {
  private model: TModel

  constructor(model: TModel) {
    super()

    this.model = model
  }

  override client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): TModel {
    const execute = this.createExecutionHandler()
    const ingest = async (identity: Identity, usage: Usage | undefined) => {
      if (usage) {
        await execute(context(identity, usage), customer)
      }
    }

    const model: LLMStrategyAISDK | LLMStrategyTanStackAI | LLMStrategyOpenAI =
      this.model

    if (isOpenAI(model)) {
      return openAIClient(model, ingest) as TModel
    }

    const methods: Record<PropertyKey, unknown> = isTanStackAI(model)
      ? tanStackAIMethods(model, ingest)
      : aiSdkMethods(model, ingest)

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
