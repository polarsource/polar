import { getServerSideAPI } from '@/utils/client/serverside'
import { ALL_METRICS, METRIC_GROUPS, toISODate } from '@/utils/metrics'
import { getAuthenticatedUser } from '@/utils/user'
import { openai } from '@ai-sdk/openai'
import { convertToModelMessages, streamText, tool, UIMessage } from 'ai'
import { z } from 'zod'

const ALL_SLUGS = ALL_METRICS.map((m) => m.slug) as [string, ...string[]]

const METRIC_CATALOG = METRIC_GROUPS.map(
  (g) =>
    `${g.category}: ${g.metrics.map((m) => `${m.slug} (${m.display_name} — ${m.description})`).join(', ')}`,
).join('\n')

const SYSTEM_PROMPT = `You are a helpful analytics assistant for the Polar dashboard. Polar is a payment infrastructure platform for developers.

You help users understand their business metrics by answering questions and showing relevant charts.

## Available metrics by category:
${METRIC_CATALOG}

## Rules:
- When the user asks about metrics, revenue, orders, subscriptions, etc., use the show_metrics tool to display charts
- Pick the most relevant metrics (1-5) for the user's question
- Choose an appropriate date range and interval based on the question (e.g. "last week" = 7 days with day interval, "today" = 1 day with hour interval, "past year" = 12 months with month interval)
- After showing metrics, provide a brief commentary on what the data shows
- If the question is not about metrics, answer conversationally
- Be concise and direct
- Today's date is ${toISODate(new Date())}`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response('AI assistant is not available', { status: 503 })
  }

  const {
    messages,
    organizationId,
  }: { messages: UIMessage[]; organizationId: string } = await req.json()

  if (!organizationId) {
    return new Response('Organization ID is required', { status: 400 })
  }

  const api = await getServerSideAPI()

  const showMetrics = tool({
    description:
      'Display metric charts to the user. Use this when the user asks about their metrics, revenue, orders, subscriptions, checkouts, cancellations, costs, or any other business data.',
    inputSchema: z.object({
      metrics: z
        .array(z.enum(ALL_SLUGS))
        .min(1)
        .max(5)
        .describe('The metric slugs to display'),
      startDate: z.string().describe('Start date in YYYY-MM-DD format'),
      endDate: z.string().describe('End date in YYYY-MM-DD format'),
      interval: z
        .enum(['hour', 'day', 'week', 'month', 'year'])
        .describe('The time interval for data points'),
    }),
    execute: async ({ metrics, startDate, endDate, interval }) => {
      const { data, error } = await api.GET('/v1/metrics/', {
        params: {
          query: {
            start_date: startDate,
            end_date: endDate,
            interval,
            organization_id: organizationId,
            timezone: 'UTC',
            metrics,
          },
        },
      })

      if (error || !data) {
        return { error: 'Failed to fetch metrics' }
      }

      return {
        totals: data.totals,
        metrics: data.metrics,
        periodCount: data.periods?.length ?? 0,
      }
    },
  })

  const result = streamText({
    model: openai('gpt-4o-mini'),
    tools: { show_metrics: showMetrics },
    toolChoice: 'auto',
    maxSteps: 3,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
