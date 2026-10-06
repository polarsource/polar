// import { defineConfig } from '@polar-sh/polar'

import { MeterSDKConfig } from '@polar-sh/polar'

export default {
  events: [
    {
      name: 'tool_call',
    },
  ],
  meters: [
    {
      id: '478a02b7-0738-4798-811f-4ffe2f7d8396',
      external_id: 'tool_call',
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
    // {
    //   name: 'SDK - Tool Calls',
    //   filter: {
    //     conjunction: 'and',
    //     clauses: [
    //       {
    //         conjunction: 'or',
    //         clauses: [{ property: 'name', operator: 'eq', value: 'tool_call' }],
    //       },
    //     ],
    //   },
    //   aggregation: { func: 'count' },
    //   unit: 'custom',
    //   custom_label: 'call',
    //   custom_multiplier: null,
    // },
  ],
} as const satisfies MeterSDKConfig
