// import { defineConfig } from '@polar-sh/polar'

import { RuntimeSDKConfig } from '@polar-sh/polar'

export default {
  events: {
    tool_call: {},
  },
  benefits: {
    custom_servers: {},
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
