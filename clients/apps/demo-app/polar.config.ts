import { defineConfig, eq } from '@polar-sh/polar'

export default defineConfig({
  // events: {
  //   tool_call: {},
  // },
  meters: ({ meter }) => ({
    tool_call: meter()
      .where(eq('name', 'tool_call'))
      .unit('custom', 'tool call')
      .count(),
  }),
  benefits: ({ featureFlag, meterCredit }) => ({
    custom_servers: featureFlag({ displayName: 'Custom servers' }),
    tool_calls: meterCredit({ displayName: 'Included tool calls' })
      .meter('tool_call')
      .units(1000),
  }),
})
