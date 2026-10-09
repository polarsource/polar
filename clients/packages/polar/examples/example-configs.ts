import {
  and,
  defineConfig,
  eq,
  eur,
  gte,
  like,
  lt,
  ne,
  or,
  per,
  perMillion,
  perThousand,
  usd,
} from '@polar-sh/polar'
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
    requests: meter().on(events['api.request']).count(),
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
    completionTokens: meter('Completion Tokens')
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
      requests: meter('Successful Requests')
        .on(events['api.request'])
        .where(successful)
        .unit('custom', 'request')
        .count(),
      averageLatency: meter('Average Latency')
        .on(events['api.request'])
        .where(successful)
        .unit('custom', 'ms')
        .avg('durationMs'),
      peakLatency: meter('Peak Latency')
        .on(events['api.request'])
        .where(successful)
        .unit('custom', 'ms')
        .max('durationMs'),
      activeAccounts: meter('Active Accounts')
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
    'webhook.delivered': z.object({}),
  },
  meters: ({ meter, events }) => ({
    inputTokens: meter('Input Tokens')
      .on(events['llm.completion'], events['llm.embedding'])
      .unit('token')
      .sum('inputTokens'),
    streamedInputTokens: meter('Streamed Input Tokens')
      .on(events['llm.completion'], events['llm.embedding'])
      .where(
        or(
          eq(events['llm.completion'].streamed, true),
          events['llm.embedding'],
        ),
      )
      .unit('token')
      .sum('inputTokens'),
    webhooks: meter('Webhooks').on(events['webhook.delivered']).count(),
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
    uploadedBytes: meter('Uploaded Bytes')
      .on(events['storage.upload'])
      .unit('custom', 'byte')
      .sum('bytes'),
    publicVideos: meter('Public Videos')
      .on(events['storage.upload'])
      .where(
        and(
          eq(events['storage.upload'].contentType, 'video'),
          eq(events['storage.upload'].public, true),
        ),
      )
      .count(),
    euUploads: meter('EU Uploads')
      .on(events['storage.upload'])
      .where(eq(events['storage.upload'].region, 'eu'))
      .count(),
  }),
})

export const checkoutConfig = defineConfig({
  events: {
    'checkout.completed': z.object({
      plan: z.enum(['starter', 'pro', 'enterprise']),
      seats: z.int(),
      annual: z.boolean(),
      coupon: z.string().optional(),
    }),
  },
  meters: ({ meter, events }) => {
    const checkout = events['checkout.completed']
    const plan = checkout.plan
    const seats = checkout.seats
    const annual = checkout.annual
    const coupon = checkout.coupon

    return {
      proSeats: meter('Pro Seats')
        .on(checkout)
        .where(eq(plan, 'pro'))
        .sum('seats'),
      annualCheckouts: meter('Annual Checkouts')
        .on(checkout)
        .where(eq(annual, true))
        .count(),
      largeTeams: meter('Large Teams')
        .on(checkout)
        .where(and(gte(seats, 50), ne(plan, 'starter')))
        .count(),
      launchCoupons: meter('Launch Coupons')
        .on(checkout)
        .where(like(coupon, 'LAUNCH'))
        .count(),
    }
  },
})

// Amounts are in the currency's major unit: usd(10) is $10.00, usd(0.5) is $0.50.
// Each price lays out its structure once and lists an amount per currency;
// every tier and every price in a product must use the same currencies.
export const pricingConfig = defineConfig({
  meters: ({ meter }) => ({
    tool_call: meter().where(eq('name', 'tool_call')).count(),
    tokens: meter().where(eq('name', 'llm.completion')).sum('tokens'),
  }),
  products: ({ product, free, fixed, seats, units, tier, meter }) => ({
    hobby: product('Hobby')
      .prices(
        free(),
        meter('tool_call')
          .flat()
          .amount(perThousand(usd(1))),
      )
      .recurring('monthly'),
    lifetime: product('Lifetime')
      .prices(fixed().amount(usd(99), eur(95)))
      .once(),
    team: product('Team')
      .prices(
        seats()
          .graduated(
            tier().max(5).amount(usd(20), eur(18)),
            tier().max(10).amount(usd(18), eur(16)),
            tier().amount(usd(15), eur(14)),
          )
          .min(3)
          .max(50),
        meter('tokens')
          .volume(
            tier()
              .max(1_000_000)
              .amount(perMillion(usd(3)), perMillion(eur(2.8))),
            // $0.075 per 1M tokens is 0.0000075¢ per token, finer than perMillion allows
            tier().amount(
              per(1_000_000_000, usd(75)),
              per(1_000_000_000, eur(70)),
            ),
          )
          .cap(usd(500), eur(475)),
      )
      .recurring(3, 'months')
      .trial(1, 'month'),
    devices: product('Devices')
      .prices(
        units()
          .flat()
          .min(1)
          .amount(usd(5))
          .max(1000)
          .label('device', 'devices'),
      )
      .recurring('yearly'),
  }),
})
