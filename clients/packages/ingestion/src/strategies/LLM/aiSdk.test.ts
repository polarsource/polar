import { generateText, streamText } from 'ai'
import {
  convertArrayToReadableStream,
  MockLanguageModelV3,
  MockLanguageModelV4,
} from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { LLMStrategy, type LLMStrategyAISDK } from '.'

const customerId = 'test-customer-id'
const prompt = 'Hello'
const content = [{ type: 'text' as const, text: 'Hi' }]
const warnings: never[] = []

const numbers = {
  inputTokens: 10,
  outputTokens: 5,
  totalTokens: 15,
  cachedInputTokens: 4,
}

const breakdown = {
  inputTokens: { total: 10, noCache: 6, cacheRead: 4, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
}

const stop = { unified: 'stop' as const, raw: undefined }

// AI SDK 7 has no mock for the v2 models of AI SDK 5
const v2 = () => ({
  specificationVersion: 'v2' as const,
  provider: 'mock-provider',
  modelId: 'mock-model-id',
  supportedUrls: {},
  doGenerate: async () => ({
    content,
    warnings,
    finishReason: 'stop' as const,
    usage: numbers,
  }),
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'finish' as const,
        finishReason: 'stop' as const,
        usage: numbers,
      },
    ]),
  }),
})

const v3 = () =>
  new MockLanguageModelV3({
    doGenerate: { content, warnings, finishReason: stop, usage: breakdown },
    doStream: {
      stream: convertArrayToReadableStream([
        { type: 'finish' as const, finishReason: stop, usage: breakdown },
      ]),
    },
  })

const v4 = () =>
  new MockLanguageModelV4({
    doGenerate: { content, warnings, finishReason: stop, usage: breakdown },
    doStream: {
      stream: convertArrayToReadableStream([
        { type: 'finish' as const, finishReason: stop, usage: breakdown },
      ]),
    },
  })

const track = <TModel extends LLMStrategyAISDK>(model: TModel) => {
  const llm = new LLMStrategy(model)
  const execute = vi.spyOn(llm, 'execute').mockResolvedValue()

  return { model: llm.client({ customerId }), execute }
}

describe.each([
  { spec: 'v2 (AI SDK 5)', create: v2 },
  { spec: 'v3 (AI SDK 6)', create: v3 },
  { spec: 'v4 (AI SDK 7)', create: v4 },
])('LLMStrategy with a $spec model', ({ create }) => {
  const usage = {
    vendor: 'mock-provider',
    model: 'mock-model-id',
    inputTokens: 10,
    cachedInputTokens: 4,
    outputTokens: 5,
    totalTokens: 15,
  }

  const context = { ...usage, strategy: 'LLM', _llm: usage }

  it('should ingest the usage of generateText', async () => {
    const { model, execute } = track(create())

    await generateText({ model, prompt })

    expect(execute).toHaveBeenCalledExactlyOnceWith(context, { customerId })
  })

  it('should ingest the usage of streamText', async () => {
    const { model, execute } = track(create())

    await streamText({ model, prompt }).consumeStream()

    expect(execute).toHaveBeenCalledExactlyOnceWith(context, { customerId })
  })
})
