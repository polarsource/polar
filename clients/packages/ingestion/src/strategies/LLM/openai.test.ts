import OpenAI from 'openai'
import { describe, expect, it, vi } from 'vitest'
import { LLMStrategy } from '.'

const customerId = 'test-customer-id'
const model = 'gpt-test'
const messages = [{ role: 'user' as const, content: 'Hello' }]

const chatUsage = {
  prompt_tokens: 10,
  completion_tokens: 5,
  total_tokens: 15,
  prompt_tokens_details: { cached_tokens: 4 },
}

const responsesUsage = {
  input_tokens: 10,
  output_tokens: 5,
  total_tokens: 15,
  input_tokens_details: { cached_tokens: 4 },
  output_tokens_details: { reasoning_tokens: 0 },
}

const completion = {
  id: 'chatcmpl-1',
  object: 'chat.completion',
  created: 0,
  model,
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: '{"answer":"Hi"}' },
      finish_reason: 'stop',
    },
  ],
  usage: chatUsage,
}

const chunk = (delta: object, usage: object | null = null) => ({
  id: 'chatcmpl-1',
  object: 'chat.completion.chunk',
  created: 0,
  model,
  choices: usage ? [] : [{ index: 0, delta, finish_reason: null }],
  usage,
})

const response = (usage: object | null) => ({
  id: 'resp-1',
  object: 'response',
  created_at: 0,
  model,
  status: usage ? 'completed' : 'in_progress',
  output: [],
  usage,
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

// Split mid-event so the strategy has to buffer across chunks
const events = (payloads: unknown[]) => {
  const text = payloads
    .map((payload) => `data: ${JSON.stringify(payload)}\n\n`)
    .concat('data: [DONE]\n\n')
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

const track = (reply: () => Response) => {
  const fetch = vi.fn(async () => reply())
  const llm = new LLMStrategy(
    new OpenAI({ apiKey: 'test', fetch, maxRetries: 0 }),
  )
  const execute = vi.spyOn(llm, 'execute').mockResolvedValue()

  return { client: llm.client({ customerId }), execute, fetch }
}

const llm = {
  vendor: 'openai',
  model,
  inputTokens: 10,
  cachedInputTokens: 4,
  outputTokens: 5,
  totalTokens: 15,
}

const tenTokens = [{ ...llm, strategy: 'LLM', _llm: llm }, { customerId }]

describe('LLMStrategy with an OpenAI client', () => {
  it('should ingest the usage of a chat completion', async () => {
    const { client, execute, fetch } = track(() => json(completion))

    const result = await client.chat.completions.create({ model, messages })

    expect(result.choices[0]?.message.content).toBe('{"answer":"Hi"}')
    expect(fetch).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of a streamed chat completion', async () => {
    const { client, execute } = track(() =>
      events([
        chunk({ role: 'assistant', content: 'H' }),
        chunk({ content: 'i' }),
        chunk({}, chatUsage),
      ]),
    )

    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    })

    let text = ''
    for await (const part of stream) {
      text += part.choices[0]?.delta.content ?? ''
    }

    expect(text).toBe('Hi')
    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should not ingest a streamed chat completion without usage', async () => {
    const { client, execute } = track(() =>
      events([chunk({ role: 'assistant', content: 'Hi' })]),
    )

    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
    })
    const types: string[] = []
    for await (const part of stream) {
      types.push(part.object)
    }

    expect(types).toEqual(['chat.completion.chunk'])
    expect(execute).not.toHaveBeenCalled()
  })

  it('should ingest the usage of the SDK helpers', async () => {
    const { client, execute } = track(() => json(completion))

    const result = await client.chat.completions.parse({
      model,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'answer', strict: true, schema: {} },
      },
    })

    expect(result.choices[0]?.message.parsed).toEqual({ answer: 'Hi' })
    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of a response', async () => {
    const { client, execute } = track(() => json(response(responsesUsage)))

    await client.responses.create({ model, input: 'Hello' })

    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should ingest the usage of a streamed response once', async () => {
    const { client, execute } = track(() =>
      events([
        { type: 'response.created', response: response(null) },
        { type: 'response.output_text.delta', delta: 'Hi' },
        { type: 'response.completed', response: response(responsesUsage) },
      ]),
    )

    const stream = await client.responses.create({
      model,
      input: 'Hello',
      stream: true,
    })
    const types: string[] = []
    for await (const part of stream) {
      types.push(part.type)
    }

    expect(types).toEqual([
      'response.created',
      'response.output_text.delta',
      'response.completed',
    ])
    expect(execute).toHaveBeenCalledExactlyOnceWith(...tenTokens)
  })

  it('should not ingest a failed request', async () => {
    const { client, execute } = track(() =>
      json({ error: { message: 'Bad request' } }, 400),
    )

    await expect(
      client.chat.completions.create({ model, messages }),
    ).rejects.toThrow('Bad request')

    expect(execute).not.toHaveBeenCalled()
  })
})
