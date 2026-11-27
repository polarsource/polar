# Examples

Ingest usage events from your application with `@polar-sh/ingestion`. [Meters](https://polar.sh/docs/features/usage-based-billing/meters) aggregate those events into usage per customer, which you can use to charge customers with [metered prices](https://polar.sh/docs/features/usage-based-billing/billing), grant [credits](https://polar.sh/docs/features/usage-based-billing/credits), and show usage in the Customer Portal.

Each example is a Next.js route handler.

## Before you start

1. Create an [Organization Access Token](https://polar.sh/docs/integrate/oat) and store it in `POLAR_ACCESS_TOKEN`.
2. Install the package:

   ```bash
   pnpm add @polar-sh/ingestion @polar-sh/sdk
   ```

3. Create one metering helper and share it across your app. It buffers events and sends them to Polar in batches:

   ```typescript
   import { Ingestion } from '@polar-sh/ingestion'
   import { createPolar } from '@polar-sh/sdk/2026-10'

   const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })
   const metering = polar.metering()

   const ingestion = Ingestion(metering)
   ```

4. [Create a meter](https://polar.sh/docs/features/usage-based-billing/meters) that filters on the event name used in the example, for example `ai_usage`.

## Identify the customer

Every event belongs to a customer. Pass one of these to `client()`:

- `external_customer_id`: your user's ID, as stored in your database.
- `customer_id`: the Polar customer ID.

The examples use `external_customer_id: 'user_123'`. Replace it with the ID of the signed-in user.

## Strategies

A strategy wraps something you already use, like an LLM client or an S3 client, and ingests an event every time it's used.

| Example                                  | Strategy               | Tracks                             |
| ---------------------------------------- | ---------------------- | ---------------------------------- |
| [`llm/`](#llm-strategy)                  | LLM Strategy           | Tokens used by every LLM call      |
| [`s3.ts`](./s3.ts)                       | S3 Strategy            | Bytes uploaded to S3               |
| [`stream.ts`](./stream.ts)               | Stream Strategy        | Bytes read from a stream           |
| [`delta-time.ts`](./delta-time.ts)       | Delta Time Strategy    | Time spent running a piece of code |
| [`opentelemetry.ts`](./opentelemetry.ts) | OpenTelemetry exporter | Spans you already record           |
| [`events.ts`](./events.ts)               | None                   | Events you build yourself          |

`opentelemetry.ts` doesn't use the metering helper yet. The exporter sends each batch of spans in its own request.

## Send buffered events

Events wait in the buffer until it sends the next batch, so make sure they leave before your process stops:

- **Serverless**, like Vercel or AWS Lambda: flush before the function is frozen. In a Next.js route handler, call `after(() => metering.flush())` as the examples do. Elsewhere, `await metering.flush()` before you return.
- **Long-running servers**, like Express or Fastify: the buffer sends batches on its own. Call `await metering.close()` when the server shuts down.

See [Metering](https://github.com/polarsource/polar/tree/main/sdk/typescript#metering) in the SDK docs for retries, timeouts and delivery errors.

## LLM Strategy

The LLM Strategy ingests the tokens used by every model call, so you can charge customers for AI usage and see what each of them costs you in [Cost Insights](https://polar.sh/docs/features/cost-insights/introduction).

### Choose your AI library

Pass a model, an adapter or a client to `LLMStrategy`. `client()` gives you back the same thing, ready to use.

| Library                                                                                 | Pass                                        | Example                                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [AI SDK](https://ai-sdk.dev) 5, 6 and 7                                                 | A model, like `openai('gpt-4o')`            | [`ai-sdk.ts`](./llm/ai-sdk.ts), [`ai-sdk-stream.ts`](./llm/ai-sdk-stream.ts)                                         |
| [TanStack AI](https://tanstack.com/ai) 1.x                                              | A text adapter, like `openaiText('gpt-4o')` | [`tanstack-ai.ts`](./llm/tanstack-ai.ts)                                                                             |
| [OpenAI SDK](https://github.com/openai/openai-node) 7.x                                 | A client, `new OpenAI()`                    | [`openai-responses.ts`](./llm/openai-responses.ts), [`openai-chat-completions.ts`](./llm/openai-chat-completions.ts) |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) 0.130 and later | A client, `new Anthropic()`                 | [`anthropic.ts`](./llm/anthropic.ts)                                                                                 |

Every model call is ingested as its own event, including each step of a tool loop and structured output. With the AI SDK and TanStack AI, you pick the model when you set up the strategy. With the OpenAI and Anthropic SDKs, you pick it on each call.

### Add a cost

Use `cost()` to attach what each call cost you, so it shows up in Cost Insights. The amount is in cents and can have decimals.

```typescript
const llmIngestion = Ingestion(metering)
  .strategy(new LLMStrategy(openai('gpt-4o')))
  .cost((ctx) => ({ amount: ctx.totalTokens * 0.0005, currency: 'usd' }))
  .ingest('ai_usage')
```

Providers usually charge less for `cachedInputTokens` and more for `outputTokens`, so split the amount by token type to match your bill.

### Change the event metadata

The event name is the first argument to `ingest()`. Pass a function as the second argument to send your own metadata instead.

```typescript
const llmIngestion = Ingestion(metering)
  .strategy(new LLMStrategy(openai('gpt-4o')))
  .ingest('ai_usage', (ctx) => ({
    model: ctx.model,
    tokens: ctx.totalTokens,
    feature: 'support_chat',
  }))
```

Your metadata replaces the default metadata, so `_llm` is no longer sent. `_cost` is still sent when you set `cost()`.

Both functions receive the token usage of the call: `inputTokens`, `cachedInputTokens`, `outputTokens`, `totalTokens`, `vendor` and `model`. `inputTokens` includes the cached tokens.

### Ingestion Payload

```json
{
  "name": "ai_usage",
  "external_customer_id": "user_123",
  "metadata": {
    "inputTokens": 100,
    "cachedInputTokens": 10,
    "outputTokens": 200,
    "totalTokens": 300,
    "vendor": "openai",
    "model": "gpt-4o-2024-08-06",
    "strategy": "LLM",
    "_cost": {
      "amount": 0.15,
      "currency": "usd"
    },
    "_llm": {
      "input_tokens": 100,
      "cached_input_tokens": 10,
      "output_tokens": 200,
      "total_tokens": 300,
      "vendor": "openai",
      "model": "gpt-4o-2024-08-06"
    }
  }
}
```

`_cost` is only sent when you set `cost()`.

## Without the metering helper

Before `polar.metering()`, you passed an access token to `Ingestion()`. This still works, but sends every event in its own request, right when it happens:

```typescript
const llmIngestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  .strategy(new LLMStrategy(openai('gpt-4o')))
  .ingest('ai_usage')
```

To switch, create the helper and pass `metering` instead. The rest of your code stays the same.
