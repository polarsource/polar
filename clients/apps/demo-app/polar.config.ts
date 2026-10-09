import { defineConfig, eur, perThousand, usd } from '@polar-sh/polar'
import { z } from 'zod'

export default defineConfig({
  events: {
    tool_call: z.object({
      tool: z.string(),
      // Could split meter into meter per server, billed differently
      server: z.enum(['builtin', 'custom']),
      // Could filter the meter to only bill for successful calls
      success: z.boolean(),
      // Could sum to a compute-time meter to bill by duration
      duration_ms: z.int(),
    }),
  },
  meters: ({ meter, events }) => ({
    tool_call: meter().on(events.tool_call).unit('custom', 'tool call').count(),
  }),
  benefits: ({ flag, credits }) => ({
    custom_servers: flag('Custom servers'),
    tool_calls: credits('Included tool calls').meter('tool_call').units(1000),
  }),
  products: ({ product, fixed, seats, units, tier, meter }) => ({
    team: product('Team')
      .prices(
        seats()
          .graduated(
            tier().max(5).amount(usd(20), eur(18)),
            tier().max(10).amount(usd(18), eur(16)),
            tier().amount(usd(15), eur(14)),
          )
          .min(1),
      )
      .recurring('monthly')
      .grants(['custom_servers']),
    servers: product('Servers')
      .prices(
        units()
          .volume(
            tier().max(10).amount(usd(10), eur(9)),
            tier().amount(usd(8), eur(7)),
          )
          .min(2)
          .label('server', 'servers'),
      )
      .recurring('monthly'),
    usage: product('Usage')
      .prices(
        meter('tool_call')
          .graduated(
            tier().included(1000),
            tier()
              .max(10000)
              .amount(perThousand(usd(2)), perThousand(eur(1.8))),
            tier().amount(perThousand(usd(1)), perThousand(eur(0.9))),
          )
          .cap(usd(200), eur(180)),
      )
      .recurring('monthly'),
    pro: product('Pro')
      .prices(
        fixed().amount(usd(99.99), eur(99.99)),
        // seats()
        //   .graduated(
        //     tier().max(5).amount(usd(20), eur(18)),
        //     tier().max(10).amount(usd(18), eur(16)),
        //     tier().amount(usd(15), eur(14)),
        //   )
        //   .min(1),
        meter('tool_call')
          .flat()
          .amount(perThousand(usd(1)), perThousand(eur(0.9)))
          .cap(usd(100), eur(90)),
      )
      .recurring('monthly')
      // .trial(14, 'days')
      .grants(['custom_servers', 'tool_calls']),
  }),
})
