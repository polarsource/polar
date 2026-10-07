// import { defineConfig } from '@polar-sh/polar'

import { RuntimeSDKConfig } from '@polar-sh/polar'

export default {
  events: {
    tool_call: {},
  },
  benefits: {
    custom_servers: {
      // Fix next - stop requiring `ID` in the `config.ts`
      id: '918c5e54-c5a7-48c2-9278-4039d70b3784',
    },
  },
  meters: {
    tool_call: {
      filter: {
        conjunction: 'and',
        clauses: [
          {
            conjunction: 'or',
            clauses: [{ property: 'name', operator: 'eq', value: 'tool_call' }],
          },
        ],
      },
      aggregation: { func: 'count' },
    },
  },
} as const satisfies RuntimeSDKConfig
