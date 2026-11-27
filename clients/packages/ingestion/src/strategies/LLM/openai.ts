import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { type FetchClient, meteredClient, postedPath } from './fetch'
import type { Ingest, Usage } from './usage'

export type LLMStrategyOpenAI = FetchClient & {
  readonly chat: object
  readonly responses: object
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

const decodePayload = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Union([OpenAIPayload, Schema.Struct({ response: OpenAIPayload })]),
  ),
)

const decodeModel = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ model: Schema.String })),
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

const generation = (input: string | URL | Request, init?: RequestInit) =>
  /\/(chat\/completions|responses(\/compact)?)$/.exec(
    postedPath(input, init) ?? '',
  )?.[1]

const decodeChatStream = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.StructWithRest(
      Schema.Struct({
        stream: Schema.Literal(true),
        stream_options: Schema.optional(
          Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
        ),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  ),
)

const withUsage = (input: string | URL | Request, init?: RequestInit) => {
  const body =
    generation(input, init) === 'chat/completions'
      ? Option.getOrUndefined(decodeChatStream(init?.body))
      : undefined

  return body
    ? {
        ...init,
        body: JSON.stringify({
          ...body,
          stream_options: { include_usage: true, ...body.stream_options },
        }),
      }
    : init
}

export const openAIClient = (client: LLMStrategyOpenAI, ingest: Ingest) =>
  meteredClient(client, {
    generates: (input, init) => generation(input, init) !== undefined,
    request: withUsage,
    read: (request) => async (text) => {
      const payload = Option.getOrUndefined(decodePayload(text))

      if (!payload) {
        return
      }

      const body = 'response' in payload ? payload.response : payload
      const model =
        body.model ?? Option.getOrUndefined(decodeModel(request?.body))?.model

      if (model) {
        await ingest({ vendor: 'openai', model }, openAIUsage(body))
      }
    },
  })
