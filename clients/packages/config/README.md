# @polar-sh/config

Define your Polar products, meters and benefits as code.

```sh
npm install @polar-sh/config
```

```ts
// polar.config.ts
import { defineConfig, usd } from '@polar-sh/config'
import { z } from 'zod'

export default defineConfig({
  events: {
    tool_call: z.object({ tool: z.string() }),
  },
  meters: ({ meter, events }) => ({
    tool_call: meter('Tool calls').on(events.tool_call).count(),
  }),
  products: ({ product, fixed }) => ({
    pro: product('Pro')
      .prices(fixed().amount(usd(20)))
      .recurring('monthly'),
  }),
})
```

Check it, save it as a draft and publish it with the [Polar CLI](https://www.npmjs.com/package/@polar-sh/cli):

```sh
polar config validate
polar config draft
polar config publish
```
