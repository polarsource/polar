import { defineConfig } from '@polar-sh/polar'
import { z } from 'zod'

export default defineConfig({
  events: {
    tool_call: z.object({ tool: z.enum(['search', 'fetch']) }),
  },
  meters: ({ meter, events }) => ({
    tool_calls: meter('Tool Calls').on(events.tool_call).count(),
  }),
  benefits: ({ flag, credits }) => ({
    custom_servers: flag('Custom servers'),
    included_tool_calls: credits('Included tool calls')
      .meter('tool_calls')
      .units(1000),
  }),
  webhooks: ({ endpoint, slack }) => ({
    app: endpoint(`${process.env.APP_URL}/api/polar/webhooks`)
      .on(
        'order.paid',
        'subscription.canceled',
        'subscription.revoked',
        'benefit_grant.created',
        'benefit_grant.revoked',
      )
      .secret('POLAR_WEBHOOK_SECRET')
      .handle(() => import('./handler')),
    sales: slack(process.env.SLACK_SALES_WEBHOOK_URL ?? '').on(
      'order.paid',
      'subscription.canceled',
    ),
  }),
})
