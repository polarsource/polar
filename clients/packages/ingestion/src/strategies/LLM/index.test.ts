import { afterEach, describe, expect, it, vi } from 'vitest'
import { LLMStrategy } from '.'

const mockEventsIngest = vi.fn()

// Mock the module before any imports
vi.mock('@polar-sh/sdk/2027-01', async (importOriginal) => ({
  ...(await importOriginal()),
  createPolar: () => ({ events: { ingest: mockEventsIngest } }),
}))

import { Ingestion } from '../../ingestion'

const mockLLMClient = {
  specificationVersion: 'v2',
  provider: 'test-provider',
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json',
  supportedUrls: {},
  doGenerate: vi.fn().mockResolvedValue({
    usage: {
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      model: 'test-model',
      vendor: 'test-provider',
    },
  }),
  doStream: vi.fn(),
} as const

describe('LLMStrategy', () => {
  const customerId = 'test-customer-id'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should call the meter handler with the correct context', async () => {
    const input = { prompt: 'Hello, world!' }

    const llm = Ingestion()
      .strategy(new LLMStrategy(mockLLMClient))
      .ingest('prompt-tokens')

    const spy = vi.spyOn(llm, 'execute')

    await llm
      .client({
        customerId,
      })
      .doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: input.prompt }],
          },
        ],
      })

    expect(spy).toHaveBeenCalledWith(
      {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        cachedInputTokens: 0,
        vendor: 'test-provider',
        model: 'test-model',
        strategy: 'LLM',
        _llm: {
          vendor: 'test-provider',
          model: 'test-model',
          inputTokens: 1,
          outputTokens: 1,
          cachedInputTokens: 0,
          totalTokens: 2,
        },
      },
      {
        customerId,
      },
    )
  })

  it('should call the cost handler with the correct context', async () => {
    const input = { prompt: 'Hello, world!' }

    const llm = Ingestion()
      .strategy(new LLMStrategy(mockLLMClient))
      .cost((ctx) => ({ amount: ctx.totalTokens * 100, currency: 'USD' }))
      .ingest('prompt-tokens')

    await llm
      .client({
        customerId,
      })
      .doGenerate({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: input.prompt }] },
        ],
      })

    expect(mockEventsIngest).toHaveBeenCalledWith({
      events: [
        {
          name: 'prompt-tokens',
          customer_id: customerId,
          metadata: {
            inputTokens: 1,
            outputTokens: 1,
            cachedInputTokens: 0,
            totalTokens: 2,
            model: 'test-model',
            vendor: 'test-provider',
            strategy: 'LLM',
            _llm: {
              vendor: 'test-provider',
              model: 'test-model',
              input_tokens: 1,
              output_tokens: 1,
              cached_input_tokens: 0,
              total_tokens: 2,
            },
            _cost: {
              amount: 200,
              currency: 'USD',
            },
          },
        },
      ],
    })
  })

  it('should return the model result and log when ingest fails', async () => {
    mockEventsIngest.mockRejectedValueOnce(new Error('Polar is down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const llm = Ingestion()
      .strategy(new LLMStrategy(mockLLMClient))
      .ingest('prompt-tokens')

    const result = await llm.client({ customerId }).doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    })

    expect(result.usage.totalTokens).toBe(2)
    expect(consoleError).toHaveBeenCalledTimes(1)
  })

  it('should finish the stream and log when ingest fails', async () => {
    mockEventsIngest.mockRejectedValueOnce(new Error('Polar is down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockLLMClient.doStream.mockResolvedValueOnce({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          })
          controller.close()
        },
      }),
    })

    const llm = Ingestion()
      .strategy(new LLMStrategy(mockLLMClient))
      .ingest('prompt-tokens')

    const { stream } = await llm.client({ customerId }).doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    })
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)

    expect(chunks).toHaveLength(1)
    expect(consoleError).toHaveBeenCalledTimes(1)
  })
})
