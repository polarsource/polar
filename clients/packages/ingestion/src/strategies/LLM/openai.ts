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
    Schema.Struct({
      cached_tokens: Schema.optional(Schema.NullOr(Schema.Number)),
    }),
  ),
)

const OpenAIPayload = Schema.Struct({
  model: Schema.optional(Schema.String),
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

const hasModel = Schema.is(Schema.Struct({ model: Schema.String }))

const isOpenAIResponseEvent = Schema.is(
  Schema.Struct({ response: OpenAIPayload }),
)

const openAIUsage = ({ usage }: typeof OpenAIPayload.Type): Usage =>
  'prompt_tokens' in usage
    ? {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cachedInputTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
      }
    : {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.total_tokens,
        cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
      }

const generation = (input: string | URL | Request, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input)
  const method =
    init?.method ?? (input instanceof Request ? input.method : 'GET')

  return method.toUpperCase() === 'POST'
    ? /\/(chat\/completions|responses(\/compact)?)$/.exec(
        new URL(url).pathname,
      )?.[1]
    : undefined
}

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const isChatStream = Schema.is(
  Schema.Struct({
    stream: Schema.Literal(true),
    stream_options: Schema.optional(
      Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
    ),
  }),
)

const withUsage = (input: string | URL | Request, init?: RequestInit) => {
  const body = typeof init?.body === 'string' ? parse(init.body) : undefined

  return generation(input, init) === 'chat/completions' && isChatStream(body)
    ? {
        ...init,
        body: JSON.stringify({
          ...body,
          stream_options: { include_usage: true, ...body.stream_options },
        }),
      }
    : init
}

// The SDK's helpers (parse, stream, runTools) bypass a wrapped create(), so meter at fetch
export const openAIClient = (client: LLMStrategyOpenAI, ingest: Ingest) => {
  const meter = async (payload: unknown, request?: RequestInit) => {
    const body = isOpenAIResponseEvent(payload) ? payload.response : payload

    if (!isOpenAIPayload(body)) {
      return
    }

    const sent = typeof request?.body === 'string' && parse(request.body)
    const model = body.model ?? (hasModel(sent) ? sent.model : undefined)

    if (model) {
      await ingest({ vendor: 'openai', model }, openAIUsage(body))
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
      const response = await fetch(input, withUsage(input, init))
      const type = response.headers.get('content-type') ?? ''

      if (!response.ok || !response.body || !generation(input, init)) {
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
          init,
        )
      }

      return response
    },
  })
}
