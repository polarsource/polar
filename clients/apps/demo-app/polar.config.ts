import { defineConfig, eq, eur, perThousand, usd } from '@polar-sh/polar'

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
  benefits: ({ flag, credits }) => ({
    custom_servers: flag('Custom servers'),
    tool_calls: credits('Included tool calls').meter('tool_call').units(1000),
  }),
  products: ({ product, seats, tier, meter }) => ({
    pro: product('Pro')
      .prices(
        seats()
          .graduated(
            tier().max(5).amount(usd(20), eur(18)),
            tier().max(10).amount(usd(18), eur(16)),
            tier().amount(usd(15), eur(14)),
          )
          .min(1),
        meter('tool_call')
          .flat()
          .amount(perThousand(usd(1)), perThousand(eur(0.9)))
          .cap(usd(100), eur(90)),
      )
      .recurring('monthly')
      .trial(14, 'days')
      .grants(['custom_servers', 'tool_calls']),
  }),
})
