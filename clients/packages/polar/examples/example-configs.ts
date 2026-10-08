import { and, defineConfig, eq, gte, lt, or } from '@polar-sh/polar'

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
