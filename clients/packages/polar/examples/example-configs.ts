import { and, defineConfig, eq, gte, lt, or } from '@polar-sh/polar'

export const requestCountConfig = defineConfig({
  meters: ({ meter }) => ({
    requests: meter().where(eq('name', 'api.request')).count(),
  }),
})

export const completionTokensConfig = defineConfig({
  meters: ({ meter }) => ({
    completionTokens: meter()
      .displayName('Completion Tokens')
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
    const successfulRequests = meter()
      .where(eq('name', 'api.request'))
      .where(and(gte('statusCode', 200), lt('statusCode', 300)))

    return {
      requests: successfulRequests
        .displayName('Successful Requests')
        .unit('custom', 'request')
        .count(),
      averageLatency: successfulRequests
        .displayName('Average Latency')
        .unit('custom', 'ms')
        .avg('durationMs'),
      peakLatency: successfulRequests
        .displayName('Peak Latency')
        .unit('custom', 'ms')
        .max('durationMs'),
      activeAccounts: successfulRequests
        .displayName('Active Accounts')
        .unique('accountId'),
    }
  },
})
