// import { defineConfig } from '@polar-sh/polar'

import type { RuntimeSDKConfig } from '@polar-sh/polar'

export default {
  events: {
    tool_call: {},
  },
  meters: {
    tool_call: {
      // Fix next - stop requiring `ID` in the `config.ts`
      id: '30b9b3e4-74fe-424d-a1d4-f5645e51f258',
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
