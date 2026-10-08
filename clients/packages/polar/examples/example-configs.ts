import { and, defineConfig, eq, gte, lt, or } from '@polar-sh/polar'
import { Schema } from 'effect'
import { z } from 'zod'

export const requestCountConfig = defineConfig({
  events: {
    'api.request': z.object({
      statusCode: z.int(),
      durationMs: z.int(),
      accountId: z.string(),
    }),
  },
  meters: ({ meter, events }) => ({
    requests: meter().on([events['api.request']]).count(),
  }),
})

export const completionTokensConfig = defineConfig({
  events: {
    'llm.completions': z.object({
      status: z.enum(['ok', 'error']),
      model: z.enum(['claude', 'gpt']),
      region: z.enum(['eu', 'us']),
      inputTokens: z.int(),
    }),
  },
  meters: ({ meter, events }) => ({
    completionTokens: meter({ displayName: 'Completion Tokens' })
      .on(events['llm.completions'])
      .where(
        and(
          eq(events['llm.completions'].status, 'ok'),
          or(
            and(
              eq(events['llm.completions'].model, 'claude'),
              eq(events['llm.completions'].region, 'eu'),
            ),
            eq(events['llm.completions'].model, 'gpt'),
          ),
        ),
      )
      .unit('token')
      .sum('inputTokens'),
  }),
})

export const apiMetricsConfig = defineConfig({
  events: {
    'api.request': z.object({
      statusCode: z.int(),
      durationMs: z.int(),
      accountId: z.string(),
    }),
  },
  meters: ({ meter, events }) => {
    const successful = and(
      gte(events['api.request'].statusCode, 200),
      lt(events['api.request'].statusCode, 300),
    )

    return {
      requests: meter({ displayName: 'Successful Requests' })
        .on(events['api.request'])
        .where(successful)
        .unit('custom', 'request')
        .count(),
      averageLatency: meter({ displayName: 'Average Latency' })
        .on(events['api.request'])
        .where(successful)
        .unit('custom', 'ms')
        .avg('durationMs'),
      peakLatency: meter({ displayName: 'Peak Latency' })
        .on(events['api.request'])
        .where(successful)
        .unit('custom', 'ms')
        .max('durationMs'),
      activeAccounts: meter({ displayName: 'Active Accounts' })
        .on(events['api.request'])
        .where(successful)
        .unique('accountId'),
    }
  },
})

export const llmUsageConfig = defineConfig({
  events: {
    'llm.completion': z.object({
      model: z.string(),
      inputTokens: z.int(),
      outputTokens: z.int(),
      streamed: z.boolean(),
    }),
    'llm.embedding': z.object({
      model: z.string(),
      inputTokens: z.int(),
    }),
  },
  meters: ({ meter, events }) => ({
    inputTokens: meter({ displayName: 'Input Tokens' })
      .on([events['llm.completion'], events['llm.embedding']])
      .unit('token')
      .sum('inputTokens'),
    streamedInputTokens: meter({ displayName: 'Streamed Input Tokens' })
      .on([events['llm.completion'], events['llm.embedding']])
      .where(
        or(
          eq(events['llm.completion'].streamed, true),
          events['llm.embedding'],
        ),
      )
      .unit('token')
      .sum('inputTokens'),
    webhooks: meter({ displayName: 'Webhooks' })
      .where(eq('name', 'webhook.delivered'))
      .count(),
  }),
})

export const storageConfig = defineConfig({
  events: {
    'storage.upload': Schema.toStandardSchemaV1(
      Schema.Struct({
        bucket: Schema.String,
        bytes: Schema.Int,
        contentType: Schema.Literals(['image', 'video', 'document']),
        public: Schema.Boolean,
        region: Schema.optional(Schema.String),
      }),
    ),
  },
  meters: ({ meter, events }) => ({
    uploadedBytes: meter({ displayName: 'Uploaded Bytes' })
      .on(events['storage.upload'])
      .unit('custom', 'byte')
      .sum('bytes'),
    publicVideos: meter({ displayName: 'Public Videos' })
      .on(events['storage.upload'])
      .where(
        and(
          eq(events['storage.upload'].contentType, 'video'),
          eq(events['storage.upload'].public, true),
        ),
      )
      .count(),
    euUploads: meter({ displayName: 'EU Uploads' })
      .on(events['storage.upload'])
      .where(eq(events['storage.upload'].region, 'eu'))
      .count(),
  }),
})
