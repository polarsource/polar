import { generateText as generateText7, streamText as streamText7 } from 'ai'
import { generateText as generateText5, streamText as streamText5 } from 'ai-v5'
import { MockLanguageModelV2 } from 'ai-v5/test'
import { generateText as generateText6, streamText as streamText6 } from 'ai-v6'
import { MockLanguageModelV3 } from 'ai-v6/test'
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { LLMStrategy, type LLMStrategyModel } from '.'

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

const v2 = () =>
  new MockLanguageModelV2({
    doGenerate: { content, warnings, finishReason: 'stop', usage: numbers },
    doStream: {
      stream: convertArrayToReadableStream([
        { type: 'finish' as const, finishReason: 'stop', usage: numbers },
      ]),
    },
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

const track = <TModel extends LLMStrategyModel>(model: TModel) => {
  const llm = new LLMStrategy(model)
  const execute = vi.spyOn(llm, 'execute').mockResolvedValue()

  return { model: llm.client({ customerId }), execute }
}

describe.each([
  {
    name: 'AI SDK 5',
    generate: async ({ model, execute } = track(v2())) => {
      await generateText5({ model, prompt })
      return execute
    },
    stream: async ({ model, execute } = track(v2())) => {
      await streamText5({ model, prompt }).consumeStream()
      return execute
    },
  },
  {
    name: 'AI SDK 6',
    generate: async ({ model, execute } = track(v3())) => {
      await generateText6({ model, prompt })
      return execute
    },
    stream: async ({ model, execute } = track(v3())) => {
      await streamText6({ model, prompt }).consumeStream()
      return execute
    },
  },
  {
    name: 'AI SDK 7',
    generate: async ({ model, execute } = track(v4())) => {
      await generateText7({ model, prompt })
      return execute
    },
    stream: async ({ model, execute } = track(v4())) => {
      await streamText7({ model, prompt }).consumeStream()
      return execute
    },
  },
  {
    name: 'AI SDK 7 with an AI SDK 5 provider',
    generate: async ({ model, execute } = track(v2())) => {
      await generateText7({ model, prompt })
      return execute
    },
    stream: async ({ model, execute } = track(v2())) => {
      await streamText7({ model, prompt }).consumeStream()
      return execute
    },
  },
])('LLMStrategy on $name', ({ generate, stream }) => {
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
    const execute = await generate()

    expect(execute).toHaveBeenCalledExactlyOnceWith(context, { customerId })
  })

  it('should ingest the usage of streamText', async () => {
    const execute = await stream()

    expect(execute).toHaveBeenCalledExactlyOnceWith(context, { customerId })
  })
})
