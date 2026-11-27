import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { type FetchClient, meteredClient, postedPath } from './fetch'
import type { Ingest } from './usage'

export type LLMStrategyAnthropic = FetchClient & { readonly messages: object }

export const isAnthropic = (model: object): model is LLMStrategyAnthropic =>
  'messages' in model && 'withOptions' in model

const Tokens = Schema.optional(Schema.NullOr(Schema.Number))

const Message = Schema.Struct({
  model: Schema.String,
  usage: Schema.Struct({
    input_tokens: Schema.Number,
    output_tokens: Schema.Number,
    cache_read_input_tokens: Tokens,
    cache_creation_input_tokens: Tokens,
  }),
})

const decodePayload = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Union([
      Schema.Struct({ type: Schema.Literal('message'), ...Message.fields }),
      Schema.Struct({
        type: Schema.Literal('message_start'),
        message: Message,
      }),
      Schema.Struct({
        type: Schema.Literal('message_delta'),
        usage: Schema.Struct({
          input_tokens: Tokens,
          output_tokens: Tokens,
          cache_read_input_tokens: Tokens,
          cache_creation_input_tokens: Tokens,
        }),
      }),
      Schema.Struct({ type: Schema.Literal('message_stop') }),
    ]),
  ),
)

export const anthropicClient = (client: LLMStrategyAnthropic, ingest: Ingest) =>
  meteredClient(client, {
    // Not count_tokens or batches, which sit below /messages
    generates: (input, init) =>
      postedPath(input, init)?.endsWith('/messages') ?? false,
    read: () => {
      let streamed: typeof Message.Type | undefined

      // Anthropic counts cache reads and writes apart from input_tokens
      const meter = ({ model, usage }: typeof Message.Type) =>
        ingest(
          { vendor: 'anthropic', model },
          {
            inputTokens:
              usage.input_tokens +
              (usage.cache_read_input_tokens ?? 0) +
              (usage.cache_creation_input_tokens ?? 0),
            outputTokens: usage.output_tokens,
            cachedInputTokens: usage.cache_read_input_tokens ?? 0,
          },
        )

      return async (text) => {
        const payload = Option.getOrUndefined(decodePayload(text))

        if (payload?.type === 'message') {
          await meter(payload)
        } else if (payload?.type === 'message_start') {
          streamed = payload.message
        } else if (payload?.type === 'message_delta' && streamed) {
          const { usage } = streamed
          const delta = payload.usage

          // Usage on a delta is cumulative, and null where unchanged
          streamed = {
            ...streamed,
            usage: {
              input_tokens: delta.input_tokens ?? usage.input_tokens,
              output_tokens: delta.output_tokens ?? usage.output_tokens,
              cache_read_input_tokens:
                delta.cache_read_input_tokens ?? usage.cache_read_input_tokens,
              cache_creation_input_tokens:
                delta.cache_creation_input_tokens ??
                usage.cache_creation_input_tokens,
            },
          }
        } else if (payload?.type === 'message_stop' && streamed) {
          await meter(streamed)
        }
      }
    },
  })
