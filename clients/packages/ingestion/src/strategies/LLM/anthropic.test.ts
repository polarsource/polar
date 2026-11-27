import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { LLMStrategy } from '.'

const customerId = 'test-customer-id'
const model = 'claude-test'
const messages = [{ role: 'user' as const, content: 'Hello' }]
const max_tokens = 1024

const usage = {
  input_tokens: 4,
  output_tokens: 5,
  cache_read_input_tokens: 4,
  cache_creation_input_tokens: 2,
}

const message = (usage: object) => ({
  id: 'msg-1',
  type: 'message',
  role: 'assistant',
  model,
  content: [{ type: 'text', text: 'Hi' }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage,
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const events = (payloads: { type: string }[]) => {
  const text = payloads
    .map(
      (payload) =>
        `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`,
    )
    .join('')
  const bytes = new TextEncoder().encode(text)
  const middle = Math.floor(bytes.length / 2)

  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, middle))
        controller.enqueue(bytes.slice(middle))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
}

const streamed = [
  {
    type: 'message_start',
    message: {
      ...message({ ...usage, output_tokens: 1 }),
      content: [],
      stop_reason: null,
    },
  },
  {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: 'Hi' },
  },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: {
      output_tokens: 5,
      input_tokens: null,
      cache_read_input_tokens: null,
      cache_creation_input_tokens: null,
    },
  },
  { type: 'message_stop' },
]

const track = (reply: () => Response) => {
  const fetch = vi.fn(async () => reply())
  const llm = new LLMStrategy(
    new Anthropic({ apiKey: 'test', fetch, maxRetries: 0 }),
  )
  const execute = vi.spyOn(llm, 'execute').mockResolvedValue()

  return { client: llm.client({ customerId }), execute, fetch }
}

const llm = {
  vendor: 'anthropic',
  model,
  inputTokens: 10,
  cachedInputTokens: 4,
  outputTokens: 5,
  totalTokens: 15,
}

const tenTokens = [{ ...llm, strategy: 'LLM', _llm: llm }, { customerId }]

describe('LLMStrategy with an Anthropic client', () => {
  it('should ingest the usage of a message', async () => {
    const { client, execute, fetch } = track(() => json(message(usage)))

    const result = await client.messages.create({
      model,
      max_tokens,
      messages,
    })

    expect(result.content).toEqual([{ type: 'text', text: 'Hi' }])
    expect(fetch).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of a streamed message once', async () => {
    const { client, execute } = track(() => events(streamed))

    const stream = await client.messages.create({
      model,
      max_tokens,
      messages,
      stream: true,
    })

    const types: string[] = []
    for await (const event of stream) {
      types.push(event.type)
    }

    expect(types).toEqual(streamed.map(({ type }) => type))
    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of the SDK helpers', async () => {
    const { client, execute } = track(() => events(streamed))

    const text = await client.messages
      .stream({ model, max_tokens, messages })
      .finalText()

    expect(text).toBe('Hi')
    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of a beta message', async () => {
    const { client, execute } = track(() => json(message(usage)))

    await client.beta.messages.create({ model, max_tokens, messages })

    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest usage without cache tokens', async () => {
    const { client, execute } = track(() =>
      json(message({ input_tokens: 10, output_tokens: 5 })),
    )

    await client.messages.create({ model, max_tokens, messages })

    const uncached = { ...llm, cachedInputTokens: 0 }

    expect(execute).toHaveBeenCalledExactlyOnceWith(
      { ...uncached, strategy: 'LLM', _llm: uncached },
      { customerId },
    )
  })

  it('should not ingest a stream that never finishes its message', async () => {
    const { client, execute } = track(() => events(streamed.slice(0, -1)))

    const stream = await client.messages.create({
      model,
      max_tokens,
      messages,
      stream: true,
    })
    for await (const _ of stream) {
      // drain
    }

    expect(execute).not.toHaveBeenCalled()
  })

  it('should not ingest a token count or a batch', async () => {
    const { client, execute } = track(() =>
      json({ ...message(usage), input_tokens: 10 }),
    )

    await client.messages.countTokens({ model, messages })
    await client.messages.batches.create({
      requests: [{ custom_id: 'one', params: { model, max_tokens, messages } }],
    })

    expect(execute).not.toHaveBeenCalled()
  })

  it('should not ingest a failed request', async () => {
    const { client, execute } = track(() =>
      json(
        {
          type: 'error',
          error: { type: 'invalid_request_error', message: 'Bad request' },
        },
        400,
      ),
    )

    await expect(
      client.messages.create({ model, max_tokens, messages }),
    ).rejects.toThrow('Bad request')

    expect(execute).not.toHaveBeenCalled()
  })
})
