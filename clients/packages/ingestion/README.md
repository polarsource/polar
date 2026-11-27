# @polar-sh/ingestion

This ingestion framework offers a robust SDK to work with Polar's event ingestion API.

## Basic Ingestion

To do basic ingestion, you can use the Ingestion function directly.

```typescript
import { Ingestion } from '@polar-sh/ingestion'

await Ingestion({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
}).ingest([
  // Ingest using Polar Customer ID
  {
    name: '<value>',
    customerId: '<value>',
    metadata: {
      myProp: 'value',
    },
  },
  // Ingest using External Customer ID from your Database
  {
    name: '<value>',
    externalCustomerId: '<id>',
    metadata: {
      myProp: 'value',
    },
  },
])
```

Or you can use the Polar SDK's Event API.

```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({
  accessToken: process.env['POLAR_ACCESS_TOKEN'] ?? '',
})

await polar.events.ingest({
  events: [
    // Ingest using Polar Customer ID
    {
      name: '<value>',
      customerId: '<value>',
      metadata: {
        myProp: 'value',
      },
    },
    // Ingest using External Customer ID from your Database
    {
      name: '<value>',
      externalCustomerId: '<id>',
      metadata: {
        myProp: 'value',
      },
    },
  ],
})
```

### Associating Costs with Events

With the Polar Event Ingestion API, you can annotate arbitrary costs with events. This unlock the possibility to see Customer Costs, Margins & Cashflow in your Polar Dashboard.

This is especially powerful with LLM calls, as token consumption typically comes with a cost for your business.

[Learn more about cost ingestion](https://polar.sh/docs/features/cost-insights/introduction#cost-events)

```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({
  accessToken: process.env['POLAR_ACCESS_TOKEN'] ?? '',
})

await polar.events.ingest({
  events: [
    // Ingest using Polar Customer ID
    {
      name: '<value>',
      customerId: '<value>',
      metadata: {
        myProp: '<value>',
        _cost: {
          amount: 100, // Amount is expected to be in cents. $1.23 should be represented as 123
          currency: 'usd',
        },
      },
    },
  ],
})
```

## Strategies

Want to report events regarding Large Language Model usage, S3 file uploads or something else? Our Ingestion strategies are customized to make it as seamless as possible to fire ingestion events for complex needs.

### LLM Strategy

Wrap any LLM model from the `@ai-sdk/*` library, a TanStack AI text adapter, or an OpenAI or Anthropic client, to automatically fire prompt- & completion tokens used by every model call.

Works with AI SDK 5, 6 and 7, TanStack AI 1.x, the OpenAI SDK 7.x, and the Anthropic SDK 0.130 and later.

```
pnpm add @polar-sh/ingestion ai @ai-sdk/openai
```

```typescript
import { Ingestion } from '@polar-sh/ingestion'
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

/**
 * Setup the LLM Ingestion Strategy
 *
 * 1. We initilize the Ingestion object with a Polar Access Token
 * 2. We attach the LLM Strategy to the ingestion instance
 * 3. (Optional) - We can calculate a cost for the LLM call, and associate it with the event
 * 4. We finally declare what name the ingested event should have
 */
const llmIngestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  .strategy(new LLMStrategy(openai('gpt-4o')))
  .cost((ctx) => ({ amount: ctx.totalTokens * 100, currency: 'USD' }))
  .ingest('openai-usage')

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json()

  // Get the wrapped LLM model with ingestion capabilities
  // Pass Customer Id to properly annotate the ingestion events with a specific customer
  const model = llmIngestion.client({
    customerId: request.headers.get('X-Polar-Customer-Id') ?? '',
  })

  const { text } = await generateText({
    model,
    system: 'You are a helpful assistant.',
    prompt,
  })

  return Response.json({ text })
}
```

#### TanStack AI

Pass a TanStack AI text adapter instead of a model. `client()` returns the adapter, ready for `chat()`. Every model call in a tool loop, and structured output, is ingested as its own event.

```
pnpm add @polar-sh/ingestion @tanstack/ai @tanstack/ai-openai
```

```typescript
import { Ingestion } from '@polar-sh/ingestion'
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM'
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'

const llmIngestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  .strategy(new LLMStrategy(openaiText('gpt-4o')))
  .ingest('openai-usage')

export async function POST(req: Request) {
  const { messages, threadId } = await req.json()

  const adapter = llmIngestion.client({
    customerId: req.headers.get('X-Polar-Customer-Id') ?? '',
  })

  const { text } = await chat({ adapter, threadId, messages, stream: false })

  return Response.json({ text })
}
```

#### OpenAI SDK

Pass an `openai` client. `client()` returns a copy of it, and every Chat Completions or Responses call made with that copy is ingested, including `parse()`, `stream()`, `runTools()` and `responses.compact()`. OpenAI only reports the usage of a streamed chat completion when asked, so `stream_options: { include_usage: true }` is added to those requests unless you set it yourself. The stream then ends with one extra chunk whose `choices` is empty. Only the call that generates is ingested, so retrieving a response later doesn't count it again, and a background response (`background: true`) isn't ingested.

```
pnpm add @polar-sh/ingestion openai
```

```typescript
import { Ingestion } from '@polar-sh/ingestion'
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM'
import OpenAI from 'openai'

// Cents per million tokens
const prices: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  'gpt-4o-2024-08-06': { input: 250, cachedInput: 125, output: 1000 },
  'gpt-4o-mini-2024-07-18': { input: 15, cachedInput: 7.5, output: 60 },
}

const llmIngestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  .strategy(new LLMStrategy(new OpenAI()))
  // The model is picked per call, and ctx.model is the dated name the API reports.
  // ctx.inputTokens includes the cached tokens, which OpenAI bills at a lower rate
  .cost((ctx) => {
    const price = prices[ctx.model]

    return {
      amount: price
        ? ((ctx.inputTokens - ctx.cachedInputTokens) * price.input +
            ctx.cachedInputTokens * price.cachedInput +
            ctx.outputTokens * price.output) /
          1_000_000
        : 0,
      currency: 'usd',
    }
  })
  .ingest('openai-usage')

export async function POST(req: Request) {
  const { prompt } = await req.json()

  const openai = llmIngestion.client({
    customerId: req.headers.get('X-Polar-Customer-Id') ?? '',
  })

  const response = await openai.responses.create({
    model: 'gpt-4o',
    input: prompt,
  })

  return Response.json({ text: response.output_text })
}
```

#### Anthropic SDK

Pass an `@anthropic-ai/sdk` client. `client()` returns a copy of it, and every Messages call made with that copy is ingested, streamed or not, including `messages.stream()`, `messages.parse()`, the tool runner and `beta.messages`. Anthropic reports cache reads and writes apart from the input tokens, so both are added to `inputTokens`, and cache reads are also reported as `cachedInputTokens`. A streamed message is ingested when it finishes, so a stream you abort isn't. Token counting and message batches aren't ingested. The Bedrock and Vertex clients are untested.

```
pnpm add @polar-sh/ingestion @anthropic-ai/sdk
```

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { Ingestion } from '@polar-sh/ingestion'
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM'

// Cents per million tokens
const prices: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  'claude-opus-5-5': { input: 400, cachedInput: 20, output: 2000 },
  'claude-sonnet-5-5': { input: 200, cachedInput: 10, output: 1000 },
}

const llmIngestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  .strategy(new LLMStrategy(new Anthropic()))
  // The model is picked per call, and ctx.model is the name the API reports.
  // ctx.inputTokens includes the cached tokens, which Anthropic bills at a lower rate
  .cost((ctx) => {
    const price = prices[ctx.model]

    return {
      amount: price
        ? ((ctx.inputTokens - ctx.cachedInputTokens) * price.input +
            ctx.cachedInputTokens * price.cachedInput +
            ctx.outputTokens * price.output) /
          1_000_000
        : 0,
      currency: 'usd',
    }
  })
  .ingest('anthropic-usage')

export async function POST(req: Request) {
  const { prompt } = await req.json()

  const anthropic = llmIngestion.client({
    customerId: req.headers.get('X-Polar-Customer-Id') ?? '',
  })

  const text = await anthropic.messages
    .stream({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      messages: [{ role: 'user', content: prompt }],
    })
    .finalText()

  return Response.json({ text })
}
```

#### Ingestion Payload

```json
{
  "customerId": "123",
  "name": "openai-usage",
  "metadata": {
    "inputTokens": 100,
    "cachedInputTokens": 10,
    "outputTokens": 200,
    "totalTokens": 300,
    "model": "gpt-4o",
    "provider": "openai.responses",
    "strategy": "LLM",
    "_cost": {
      "amount": 123, // Amount is expected to be in cents. $1.23 should be represented as 123
      "currency": "usd"
    },
    "_llm": {
      ... //
    }
  }
}
```

### S3 Strategy

Wrap the official AWS S3 Client with our S3 Ingestion Strategy to automatically ingest bytes uploaded.

```
pnpm add @polar-sh/ingestion @aws-sdk/client-s3
```

```typescript
import { Ingestion } from '@polar-sh/ingestion'
import { S3Strategy } from '@polar-sh/ingestion/strategies/S3'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// Setup the S3 Ingestion Strategy
const s3Ingestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  .strategy(new S3Strategy(s3Client))
  .ingest('s3-uploads')

export async function POST(request: Request) {
  try {
    // Get the wrapped S3 Client
    // Pass Customer Id to properly annotate the ingestion events with a specific customer
    const s3 = s3Ingestion.client({
      customerId: request.headers.get('X-Polar-Customer-Id') ?? '',
    })

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: 'a-random-key',
        Body: JSON.stringify({
          name: 'John Doe',
          age: 30,
        }),
        ContentType: 'application/json',
      }),
    )

    return Response.json({})
  } catch (error) {
    return Response.json({ error: error.message })
  }
}
```

#### Ingestion Payload

```json
{
  "customerId": "123",
  "name": "s3-uploads",
  "metadata": {
    "bytes": 100,
    "bucket": "my-bucket",
    "key": "my-key",
    "contentType": "application/text",
    "strategy": "S3"
  }
}
```

### Stream Strategy

Wrap any Readable or Writable stream of choice to automatically ingest the bytes consumed.

```
pnpm add @polar-sh/ingestion
```

```typescript
import { Ingestion } from '@polar-sh/ingestion';
import { StreamStrategy } from '@polar-sh/ingestion/strategies/Stream';

const myReadstream = createReadStream(...);

// Setup the Stream Ingestion Strategy
const streamIngestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  .strategy(new StreamStrategy(myReadstream))
  .ingest("my-stream");

export async function GET(request: Request) {
  try {

    // Get the wrapped stream
    // Pass Customer Id to properly annotate the ingestion events with a specific customer
    const stream = streamIngestion.client({
      customerId: request.headers.get("X-Polar-Customer-Id") ?? ""
    });

    // Consume stream...
    stream.on('data', () => ...)

    return Response.json({});
  } catch (error) {
    return Response.json({ error: error.message });
  }
}
```

#### Ingestion Payload

```json
{
  "customerId": "123",
  "name": "my-stream",
  "metadata": {
    "bytes": 100,
    "strategy": "Stream"
  }
}
```

### DeltaTime Strategy

Ingest delta time of arbitrary execution. Bring your own now-resolver.

```
pnpm add @polar-sh/ingestion
```

```typescript
import { Ingestion } from '@polar-sh/ingestion'
import { DeltaTimeStrategy } from '@polar-sh/ingestion/strategies/DeltaTime'

const nowResolver = () => performance.now()
// const nowResolver = () => Number(hrtime.bigint())
// const nowResolver = () => Date.now()

// Setup the Delta Time Ingestion Strategy
const deltaTimeIngestion = Ingestion({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
})
  .strategy(new DeltaTimeStrategy(nowResolver))
  .ingest('execution-time')

export async function GET(request: Request) {
  try {
    // Get the wrapped start clock function
    // Pass Customer Id to properly annotate the ingestion events with a specific customer
    const start = deltaTimeIngestion.client({
      customerId: request.headers.get('X-Polar-Customer-Id') ?? '',
    })

    const stop = start()

    await sleep(1000)

    // { deltaTime: xxx } is automatically ingested to Polar
    const delta = stop()

    return Response.json({ delta })
  } catch (error) {
    return Response.json({ error: error.message })
  }
}
```

#### Ingestion Payload

```json
{
  "customerId": "123",
  "name": "execution-time",
  "metadata": {
    "deltaTime": 1000,
    "strategy": "DeltaTime"
  }
}
```
