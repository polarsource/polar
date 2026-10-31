import { defineConfig, eq, usd } from '@polar-sh/polar'

export default defineConfig({
  meters: ({ meter }) => ({
    tool_calls: meter('Tool calls')
      .where(eq('name', 'tool_call'))
      .count(),
  }),
  benefits: ({ credits }) => ({
    included_tool_calls: credits('Included tool calls')
      .meter('tool_calls')
      .units(1000),
  }),
  products: ({ product, free, fixed }) => ({
    free: product('Free')
      .prices(
        free(),
      )
      .recurring('monthly'),
    pro: product('Pro')
      .prices(
        fixed().amount(usd(29)),
      )
      .recurring('monthly')
      .grants(['included_tool_calls']),
  }),
})
