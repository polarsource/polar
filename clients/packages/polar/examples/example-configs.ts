import {
  and,
  defineConfig,
  eq,
  eur,
  gte,
  lt,
  or,
  per,
  perMillion,
  perThousand,
  tier,
  usd,
} from '@polar-sh/polar'

export const requestCountConfig = defineConfig({
  meters: ({ meter }) => ({
    requests: meter().where(eq('name', 'api.request')).count(),
  }),
})

export const completionTokensConfig = defineConfig({
  meters: ({ meter }) => ({
    completionTokens: meter('Completion Tokens')
      .where(
        and(
          eq('name', 'llm.completions'),
          eq('status', 'ok'),
          or(
            and(eq('model', 'claude'), eq('region', 'eu')),
            eq('model', 'gpt'),
          ),
        ),
      )
      .unit('token')
      .sum('inputTokens'),
  }),
})

export const apiMetricsConfig = defineConfig({
  meters: ({ meter }) => {
    const successfulRequests = and(
      eq('name', 'api.request'),
      gte('statusCode', 200),
      lt('statusCode', 300),
    )

    return {
      requests: meter('Successful Requests')
        .where(successfulRequests)
        .unit('custom', 'request')
        .count(),
      averageLatency: meter('Average Latency')
        .where(successfulRequests)
        .unit('custom', 'ms')
        .avg('durationMs'),
      peakLatency: meter('Peak Latency')
        .where(successfulRequests)
        .unit('custom', 'ms')
        .max('durationMs'),
      activeAccounts: meter('Active Accounts')
        .where(successfulRequests)
        .unique('accountId'),
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
  products: ({ product, free, fixed, seats, units, meter }) => ({
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
      .prices(units().flat().min(1).amount(usd(5)).max(1000))
      .recurring('yearly'),
  }),
})
