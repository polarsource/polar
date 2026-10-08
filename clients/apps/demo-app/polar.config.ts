import { defineConfig, eq } from '@polar-sh/polar'

export default defineConfig({
  // events: {
  //   tool_call: {},
  // },
  // benefits: {
  //   custom_servers: {
  //     // Fix next - stop requiring `ID` in the `config.ts`
  //     id: '918c5e54-c5a7-48c2-9278-4039d70b3784',
  //   },
  // },
  meters: ({ meter }) => ({
    tool_call: meter()
      .where(eq('name', 'tool_call'))
      .unit('custom', 'tool call')
      .count(),
  }),
})
