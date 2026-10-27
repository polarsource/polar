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
    tool_call: meter('Tool calls!')
      .on(events.tool_call)
      .unit('custom', 'tool calls')
      .count(),
  }),
  benefits: ({ flag, credits }) => ({
    custom_servers: flag('Custom servers').metadata({ tag: 'primary' }),
    tool_calls: credits('Included tool calls').meter('tool_call').units(1200),
    free_tool_calls: credits('Free tool calls').meter('tool_call').units(5),
    // Rollover keeps purchased credits across the Pro billing cycle reset
    topup_100: credits('100 extra tool calls')
      .meter('tool_call')
      .units(100)
      .rollover(),
    topup_500: credits('500 extra tool calls')
      .meter('tool_call')
      .units(500)
      .rollover(),
    topup_1000: credits('1,000 extra tool calls')
      .meter('tool_call')
      .units(1000)
      .rollover(),
  }),
  products: ({ product, free, fixed, seats, units, tier, meter }) => ({
    free: product('Free')
      .prices(free())
      .recurring('monthly')
      .grants(['free_tool_calls']),
    team: product('Team')
      .prices(
        seats()
          .graduated(
            tier().max(5).amount(usd(24), eur(18)),
            tier().max(10).amount(usd(18), eur(12)),
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
            tier().max(10).amount(usd(19), eur(14)),
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
        fixed().amount(usd(99.99), eur(299.99)),
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
    topup_100: product('100 tool calls')
      .prices(fixed().amount(usd(9), eur(5)).tax('inclusive'))
      .once()
      .grants(['topup_100']),
    topup_500: product('500 tool calls')
      .prices(fixed().amount(usd(39), eur(30)).tax('exclusive'))
      .once()
      .grants(['topup_500']),
    topup_1000: product('1,000 tool calls')
      .prices(fixed().amount(usd(79), eur(50)).tax('location'))
      .once()
      .grants(['topup_1000']),
  }),
})
