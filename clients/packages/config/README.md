# @polar-sh/config

Define your Polar products, meters and benefits as code.

```sh
npm install @polar-sh/config zod
```

Events are described with any [Standard Schema](https://standardschema.dev) validator. The example below uses Zod, but Valibot, ArkType and Effect Schema work too.

`.withTokens()` adds LLM usage to an event as `_llm` (`vendor`, `model`, `input_tokens`, `output_tokens`, `total_tokens` and optionally `cached_input_tokens`), and `.withCosts()` adds what it cost you as `_cost` (`amount` in cents, `currency`). Meters on those events can then aggregate paths like `_llm.total_tokens` or `_cost.amount`.

```ts
// polar.config.ts
import { defineConfig, usd } from '@polar-sh/config'
import { z } from 'zod'

export default defineConfig({
  events: ({ event }) => ({
    tool_call: event(z.object({ tool: z.string() })),
    completion: event(z.object({ feature: z.string() }))
      .withTokens()
      .withCosts(),
  }),
  meters: ({ meter, events }) => ({
    tool_call: meter('Tool calls').on(events.tool_call).count(),
    tokens: meter('Tokens')
      .on(events.completion)
      .unit('token')
      .sum('_llm.total_tokens'),
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

Publishing needs the `catalog:publish` scope. Give it only to the tokens that should change live pricing, such as the one your deploy pipeline uses.
