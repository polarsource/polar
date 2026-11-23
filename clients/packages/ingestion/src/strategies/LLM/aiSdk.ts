import * as Schema from 'effect/Schema'
import type { Ingest, Usage } from './usage'

const TokenBreakdown = Schema.Struct({
  total: Schema.optional(Schema.Number),
  cacheRead: Schema.optional(Schema.Number),
})

// AI SDK 5 reports plain numbers, 6 and later a breakdown per direction
type TokenCount = number | typeof TokenBreakdown.Type | undefined

type AISDKUsage = {
  inputTokens: TokenCount
  outputTokens: TokenCount
  totalTokens?: number | undefined
  cachedInputTokens?: number | undefined
}

// The part of an AI SDK language model the strategy reads, in any spec version
export type LLMStrategyAISDK = {
  readonly provider: string
  readonly modelId: string
  doGenerate(options: never): PromiseLike<{ usage: AISDKUsage }>
  doStream(options: never): PromiseLike<{
    stream: ReadableStream<{ type: string; usage?: AISDKUsage }>
  }>
}

const isBreakdown = Schema.is(TokenBreakdown)

const total = (tokens: TokenCount) =>
  (isBreakdown(tokens) ? tokens.total : tokens) ?? 0

const cacheRead = (tokens: TokenCount) =>
  isBreakdown(tokens) ? tokens.cacheRead : undefined

const aiSdkUsage = (usage: AISDKUsage | undefined): Usage | undefined =>
  usage && {
    inputTokens: total(usage.inputTokens),
    outputTokens: total(usage.outputTokens),
    totalTokens: usage.totalTokens,
    cachedInputTokens: usage.cachedInputTokens ?? cacheRead(usage.inputTokens),
  }

export const aiSdkMethods = (model: LLMStrategyAISDK, ingest: Ingest) => {
  const identity = { vendor: model.provider, model: model.modelId }

  return {
    doGenerate: async (options: never) => {
      const result = await model.doGenerate(options)
      await ingest(identity, aiSdkUsage(result.usage))

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
                await ingest(identity, aiSdkUsage(chunk.usage))
              }

              controller.enqueue(chunk)
            },
          }),
        ),
      }
    },
  }
}
