import * as Schema from 'effect/Schema'
import type { Ingest, Usage } from './usage'

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type LLMStrategyOpenAI = {
  readonly chat: object
  readonly responses: object
  withOptions(options: { fetch: Fetch }): unknown
}

export const isOpenAI = (model: object): model is LLMStrategyOpenAI =>
  'responses' in model && 'withOptions' in model

const CachedTokens = Schema.optional(
  Schema.NullOr(
    Schema.Struct({ cached_tokens: Schema.optional(Schema.Number) }),
  ),
)

const OpenAIPayload = Schema.Struct({
  model: Schema.String,
  usage: Schema.Union([
    Schema.Struct({
      prompt_tokens: Schema.Number,
      completion_tokens: Schema.Number,
      total_tokens: Schema.optional(Schema.Number),
      prompt_tokens_details: CachedTokens,
    }),
    Schema.Struct({
      input_tokens: Schema.Number,
      output_tokens: Schema.Number,
      total_tokens: Schema.optional(Schema.Number),
      input_tokens_details: CachedTokens,
    }),
  ]),
})

const isOpenAIPayload = Schema.is(OpenAIPayload)

const isOpenAIResponseEvent = Schema.is(
  Schema.Struct({ response: OpenAIPayload }),
)

const openAIUsage = ({ usage }: typeof OpenAIPayload.Type): Usage =>
  'prompt_tokens' in usage
    ? {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cachedInputTokens: usage.prompt_tokens_details?.cached_tokens,
      }
    : {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.total_tokens,
        cachedInputTokens: usage.input_tokens_details?.cached_tokens,
      }

// The SDK's helpers (parse, stream, runTools) bypass a wrapped create(), so meter at fetch
export const openAIClient = (client: LLMStrategyOpenAI, ingest: Ingest) => {
  const meter = async (payload: unknown) => {
    const body = isOpenAIResponseEvent(payload) ? payload.response : payload

    if (isOpenAIPayload(body)) {
      await ingest({ vendor: 'openai', model: body.model }, openAIUsage(body))
    }
  }

  const parse = (text: string): unknown => {
    try {
      return JSON.parse(text)
    } catch {
      return undefined
    }
  }

  const meterEvents = () => {
    const decoder = new TextDecoder()
    let buffer = ''

    const read = async (text: string) => {
      const lines = (buffer + text).split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data:')) {
          await meter(parse(line.slice(5)))
        }
      }
    }

    return new TransformStream<Uint8Array, Uint8Array>({
      transform: async (chunk, controller) => {
        await read(decoder.decode(chunk, { stream: true }))
        controller.enqueue(chunk)
      },
      flush: () => read(`${decoder.decode()}\n`),
    })
  }

  // Private in the SDK's types, but it holds the app's own fetch
  const fetch: Fetch = Reflect.get(client, 'fetch') ?? globalThis.fetch

  return client.withOptions({
    fetch: async (input, init) => {
      const response = await fetch(input, init)
      const type = response.headers.get('content-type') ?? ''

      if (!response.ok || !response.body) {
        return response
      }

      if (type.includes('text/event-stream')) {
        return new Response(response.body.pipeThrough(meterEvents()), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      }

      if (type.includes('application/json')) {
        await meter(
          await response
            .clone()
            .json()
            .catch(() => undefined),
        )
      }

      return response
    },
  })
}
