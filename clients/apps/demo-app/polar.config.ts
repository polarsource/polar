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
    tool_call_pack: credits('Tool call pack').meter('tool_call').units(10),
  }),
  products: ({ product, fixed, meter }) => ({
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
      .grants(['custom_servers', 'tool_call_pack']),
    tool_call_pack: product('10 tool calls')
      .prices(fixed().amount(usd(1), eur(0.9)))
      .once()
      .grants(['tool_call_pack']),
  }),
})
