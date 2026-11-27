import { type AnyTextAdapter, chat, toolDefinition } from '@tanstack/ai'
import { describe, expect, it, vi } from 'vitest'
import { LLMStrategy } from '.'

const customerId = 'test-customer-id'
const messages = [{ role: 'user' as const, content: 'Hello' }]
const threadId = 'thread'

const tanStackUsage = {
  promptTokens: 10,
  completionTokens: 5,
  totalTokens: 15,
  promptTokensDetails: { cachedTokens: 4 },
}

const specUsage = [
  { inputTokens: 6, outputTokens: 3, totalTokens: 9, cachedInputTokens: 4 },
  { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
]

type Turn = {
  text?: string
  toolCall?: string
  usage: unknown
  fail?: 'event' | 'throw'
}

const failure = (usage: unknown) =>
  Object.assign(new Error('Maximum tokens reached'), { usage })

// A class like the real adapters, so the strategy must keep its prototype and private fields
class MockAdapter {
  readonly kind = 'text' as const
  readonly name = 'mock-provider'
  readonly model = 'mock-model-id'
  readonly #turns: Turn[]

  constructor(turns: Turn[]) {
    this.#turns = turns
  }

  async *chatStream() {
    const turn = this.#turns.shift()!
    const ids = { runId: 'run', threadId: 'thread', model: this.model }

    yield { type: 'RUN_STARTED', ...ids, timestamp: Date.now() }

    if (turn.fail === 'throw') {
      throw failure(turn.usage)
    }

    if (turn.fail === 'event') {
      yield {
        type: 'RUN_ERROR',
        ...ids,
        timestamp: Date.now(),
        message: 'Maximum tokens reached',
        usage: turn.usage,
      }
      return
    }

    if (turn.toolCall) {
      const toolCallId = 'call-1'
      const base = { toolCallId, toolCallName: turn.toolCall, timestamp: 0 }
      yield { type: 'TOOL_CALL_START', ...base, toolName: turn.toolCall }
      yield { type: 'TOOL_CALL_ARGS', ...base, delta: '{}' }
      yield { type: 'TOOL_CALL_END', ...base, toolName: turn.toolCall }
    } else {
      const base = { messageId: 'message', timestamp: 0 }
      yield { type: 'TEXT_MESSAGE_START', ...base, role: 'assistant' }
      yield { type: 'TEXT_MESSAGE_CONTENT', ...base, delta: turn.text ?? '' }
      yield { type: 'TEXT_MESSAGE_END', ...base }
    }

    yield {
      type: 'RUN_FINISHED',
      ...ids,
      timestamp: Date.now(),
      finishReason: turn.toolCall ? 'tool_calls' : 'stop',
      usage: turn.usage,
    }
  }

  async structuredOutput() {
    const { usage, fail } = this.#turns.shift()!

    if (fail) {
      throw failure(usage)
    }

    return { data: { answer: 'Hi' }, rawText: '{"answer":"Hi"}', usage }
  }
}

const track = (turns: Turn[]) => {
  // Typed as a real adapter, so this also checks TanStack AI's type fits the strategy
  const llm = new LLMStrategy(
    new MockAdapter(turns) as unknown as AnyTextAdapter,
  )
  const execute = vi.spyOn(llm, 'execute').mockResolvedValue()

  return { adapter: llm.client({ customerId }), execute }
}

const event = (usage: {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  totalTokens: number
}) => {
  const llm = { vendor: 'mock-provider', model: 'mock-model-id', ...usage }

  return [{ ...llm, strategy: 'LLM', _llm: llm }, { customerId }]
}

const tenTokens = event({
  inputTokens: 10,
  cachedInputTokens: 4,
  outputTokens: 5,
  totalTokens: 15,
})

describe('LLMStrategy with a TanStack AI adapter', () => {
  it('should ingest the usage of a streamed chat', async () => {
    const { adapter, execute } = track([{ text: 'Hi', usage: tanStackUsage }])

    const types: string[] = []
    for await (const chunk of chat({ adapter, threadId, messages })) {
      types.push(chunk.type)
    }

    expect(types).toContain('RUN_FINISHED')

    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of a chat that is not streamed', async () => {
    const { adapter, execute } = track([{ text: 'Hi', usage: tanStackUsage }])

    await expect(
      chat({ adapter, threadId, messages, stream: false }),
    ).resolves.toMatchObject({
      text: 'Hi',
    })

    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest every model call of a tool loop', async () => {
    const { adapter, execute } = track([
      { toolCall: 'lookup', usage: tanStackUsage },
      { text: 'Hi', usage: tanStackUsage },
    ])

    const lookup = toolDefinition({
      name: 'lookup',
      description: 'Look something up',
    }).server(async () => 'found')

    await chat({ adapter, threadId, messages, tools: [lookup], stream: false })

    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute).toHaveBeenNthCalledWith(1, ...tenTokens)
    expect(execute).toHaveBeenNthCalledWith(2, ...tenTokens)
  })

  it('should ingest the usage of structured output', async () => {
    const { adapter, execute } = track([{ usage: tanStackUsage }])

    const result = await chat({
      adapter,
      threadId,
      messages,
      outputSchema: {
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer'],
      },
    })

    expect(result).toEqual({ answer: 'Hi' })
    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of a run that ends with an error', async () => {
    const { adapter, execute } = track([
      { usage: tanStackUsage, fail: 'event' },
    ])

    const types: string[] = []
    for await (const chunk of chat({ adapter, threadId, messages })) {
      types.push(chunk.type)
    }

    expect(types).toContain('RUN_ERROR')
    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of a stream that throws', async () => {
    const { adapter, execute } = track([
      { usage: tanStackUsage, fail: 'throw' },
    ])

    await expect(
      chat({ adapter, threadId, messages, stream: false }),
    ).rejects.toThrow('Maximum tokens reached')

    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of structured output that throws', async () => {
    const { adapter, execute } = track([
      { usage: tanStackUsage, fail: 'throw' },
    ])

    await expect(
      chat({
        adapter,
        threadId,
        messages,
        outputSchema: {
          type: 'object',
          properties: { answer: { type: 'string' } },
          required: ['answer'],
        },
      }),
    ).rejects.toThrow('Maximum tokens reached')

    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should add up usage reported per model in the AG-UI form', async () => {
    const { adapter, execute } = track([{ text: 'Hi', usage: specUsage }])

    await chat({ adapter, threadId, messages, stream: false })

    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should not ingest a run without usage', async () => {
    const { adapter, execute } = track([{ text: 'Hi', usage: undefined }])

    await chat({ adapter, threadId, messages, stream: false })

    expect(execute).not.toHaveBeenCalled()
  })
})
