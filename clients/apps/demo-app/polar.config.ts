import { defineConfig, eq, eur, perThousand, tier, usd } from '@polar-sh/polar'

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
  products: ({ product, seats, meter }) => ({
    pro: product('Pro')
      .prices(
        seats()
          .graduated(
            tier().max(5).amount(usd(2000), eur(1800)),
            tier().max(10).amount(usd(1800), eur(1600)),
            tier().amount(usd(1500), eur(1400)),
          )
          .min(1),
        meter('tool_call')
          .flat()
          .amount(perThousand(usd(100)), perThousand(eur(90)))
          .cap(usd(10000), eur(9000)),
      )
      .recurring('monthly')
      .trial(14, 'days')
      .grants(['custom_servers', 'tool_calls']),
  }),
})
