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

// Amounts are in the currency's smallest unit: usd(1000) is $10.00.
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
          .amount(perThousand(usd(100))),
      )
      .recurring('monthly'),
    lifetime: product('Lifetime')
      .prices(fixed().amount(usd(9900), eur(9500)))
      .once(),
    team: product('Team')
      .prices(
        seats()
          .graduated(
            tier().max(5).amount(usd(2000), eur(1800)),
            tier().max(10).amount(usd(1800), eur(1600)),
            tier().amount(usd(1500), eur(1400)),
          )
          .min(3)
          .max(50),
        meter('tokens')
          .volume(
            tier()
              .max(1_000_000)
              .amount(perMillion(usd(300)), perMillion(eur(280))),
            // $0.075 per 1M tokens is 0.0000075¢ per token, finer than perMillion allows
            tier().amount(
              per(1_000_000_000, usd(7500)),
              per(1_000_000_000, eur(7000)),
            ),
          )
          .cap(usd(50000), eur(47500)),
      )
      .recurring(3, 'months')
      .trial(1, 'month'),
    devices: product('Devices')
      .prices(units().flat().min(1).amount(usd(500)).max(1000))
      .recurring('yearly'),
  }),
})
