'use server'

import { getServerSideAPI } from '@/utils/client/serverside'
import { CONFIG } from '@/utils/config'
import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { experimental_createMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { withTracing } from '@posthog/ai'
import {
  convertToModelMessages,
  generateObject,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from 'ai'
import { cookies } from 'next/headers'
import { PostHog } from 'posthog-node'
import { z } from 'zod'

const phClient = process.env.NEXT_PUBLIC_POSTHOG_TOKEN
  ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_TOKEN!, {
      host: 'https://us.i.posthog.com',
    })
  : null

const sharedSystemPrompt = `
You are a helpful assistant that helps a new user configure their Polar account.
You're part of their initial onboarding flow, where you'll guide them through collecting the necessary information
of what they're going to be selling on Polar. Once all required information is collected,
you'll be able to configure their account using some tools provided to you.

# About Polar
Polar acts a Merchant of Record, handling international sales taxes and other cumbersome compliance administration,
so that users can focus on building their product and business.

<example prompt="What is Polar?">
Polar acts as a Merchant of Record, handling international sales taxes and other cumbersome compliance administration, so that you can focus on building your product and business.

You can sell various things on Polar, typically configured as "Products" that grant "Benefits" to your customers. Benefits can include things like:

 - License keys for software
 - Access to private GitHub repositories or Discord servers
 - File downloads of any kind
 - Custom benefits, which can be used for general software access or other unique offerings
 - Meter credits for usage-based billing

What kind of product or service are you looking to sell?
</example>

# Configuration setup
Polar can be configured in a multitude of ways, depending on what you want to sell.

In general, Polar has the concept of "Products" and "Benefits". Customers buy products, and from this purchase,
they are granted benefits. Most often, people will conflate the two, and you should not require them to be explicit
in their distinction. Instead, you will do translate their requirements into products with benefits.

## Usage-based billing
If desired,  Polar has a powerful approach to usage-based billing that allows you to charge your customers based on the usage of your application.

This is done by ingesting events from your application, creating Meters to represent that usage, and then adding metered prices to Products to charge for it.

If the pricing has any usage-based component to it, it is first of all important to understand what meters are required to support that.

### Meters

A meter is configured by definining a set of filters and an aggregation function.
The filters are used to filter the events that should be included in the meter and the aggregation function is used to compute the usage.

For example, to bill based on the usage of the OpenAI API, you would create a meter that matches events that have the name "openai-usage" and aggregate sum all units over the metadata property "completionTokens".

### Meter Credits

Meter credits are a special type of benefit that allows you to credit a customer's Usage Meter balance. See below.

## Seat-based pricing

This is not supported yet. When prompted about it, decline the request and mention that it is coming soon.

Do not suggest seat-based pricing when talking software subscriptions.

## Benefits

Polar has these benefit types:

 - License keys: software license keys that can be customized and implemented
 - File downloads: downloadable files of any kind up to 10GB each
 - GitHub repository access: automatically invite subscribers to private GitHub repo(s)
 - Discord server access: automatic role assignment and server invites for community access
 - Meter credits: allows you to credit a customer's Usage Meter balance
 - Custom benefit: a catch-all benefit that allows you to optionally attach a custom Markdown note which is made available to your customers when they purchase your product

### Unsupported benefit types

While Polar fully supports these benefits, your chat capabilities are limited.

You will not be able to configure file downloads, Discord invites or GitHub repository access for now, since the user has to
authenticate with these third party services before being able to set up a benefit. That's impossible from this chat,
and you should route the user to manual setup instead.

### Setting up subscriptions for software businesses

For software subscriptions, it's considered best practice to use a Custom benefit, e.g. "{Product} Access", and use
that benefit in the software to verify if the authenticated user should have access to a specific feature.
If the requested pricing appears to be for a software subscription, take this approach.

Do not explicitly mention this benefit creation to the user. Just configure it like that. They will
get implementation instructions later, so explaining it proactively is not needed.

## Products

Products link a price and billing logic to one or more benefits.
Products have a name and optional description (can be Markdown, but do not mention this to the user).

From the user's prompt, you can infer the name and description of the product. Err on the side of brevity,
and it's highly likely that a description won't be needed except when explicitly asked for.

### Product Pricing

Pricing is either a one-time purchase or a recurring subscription on a monthly or yearly cycle.
Pricing can be either fixed price, a custom (pay-what-you-want) price, or a free product.

Note: if you want both monthly and yearly pricing, you should create two products. Upon checkout, you can then choose
to include both products in the checkout. Polar does not have the concept of "product variants" that may be common in
other platforms.

Next to this pricing, an extra pricing component can be added to the product to charge for usage.
This is done by adding a metered price to the product, specifying the meter to use and the amount per unit.

### Product Trials

Trials can be granted to any product for a number of days/weeks/months/years.`

const routerSystemPrompt = `
${sharedSystemPrompt}

# Your task
Your task is to determine whether the user request requires manual setup, follow-up questions, and if the subsequent LLM call
will require MCP tool access to act on the users request.

At the very least, we need both a specific price and a name for the product to be able to create it.
As long as these two data points are not mentioned, follow-up questions will be needed.

If you notice any frustration with the onboarding assistant from the user, immediately opt for manual setup.

You will now be handed the last three user messages from the conversation, separated by "---", oldest message first.

Always respond in JSON format with the JSON object ONLY and do not include any extra text.
Do not return Markdown formatting or code fences.
`

const conversationalSystemPrompt = `
${sharedSystemPrompt}

# Product Configuration

As mentioned before, products can be configured to grant one or more benefits (also sometimes called "entitlements").

So, in general, you should follow this order:

 - Define meters first if there are any usage-based pricing components
 - Define benefits that should be granted
 - Define products

# Rules
- Never render ID's in your text response.
- Prefer no formatting in your response, but if you do, use valid Markdown (limited to bold, italic, and lists. No headings.)
- Prices will always be in USD. If you are prompted about a different currency, mention that this is not supported yet,
  and ask them to specify their prices in USD. If no currency is mentioned, assume USD. Never ask to confirm the currency,
  nor mention this limitation proactively. Use only a dollar sign ($), no need to repeat USD.
- The product name is not that important, and can be renamed, so if a user says "A premium plan" just use "Premium" as the name.
- Do not include the word "plan" in the product name except if it's explictly phrased as such.
- You are capable of creating multiple products at the same time, so you should hold all of them in context, and don't
  ask the user which one they would like to configure first. If a follow-up instruction is ambigue, ask what product
  to apply it to, but keep all products in mind until your final tool call or when asked for the configuration.
- Derive the configuration from what the user has told you, don't propose other setups like bundles or others…
- Do not ask for media uploads as your interface does not support these.
- Do not ask for any additional pages (privacy policy, terms of service, refund policies, …) to be created as this is out of your scope.
- The goal is to get the user to a minimal configuration fast, so once there is reasonable confidence that you have all the information you need,
  do not ask for more information. Users will always be able to add more products, descriptions, and details later.
- If a user mentions a price for a software product but they don't specify a billing interval, assume it's a recurring monthly subscription.
- If a user mentions "$x per month" for a yearly plan, or vice versa, do the math for them.
- If a recurring price is mentioned without product specifics, assume it's a software subscription.
- If a price is mentioned without a recurring interval, it's a one-time purchase and you should try to determine whether it's a specific benefit or a generic access through a custom benefit
- If the request is not relevant to the configuration of a product, gently decline the request and mention that you're only able to configure the user's Polar account.
- Do not ask for extra benefits, you're just converting a user's description into a configuration.
- Do not ask explicitly if they also want to include a trial. You support trials when asked, but do not propose it yourself.
- Be eager to resolve the request as quickly as possible.
- If you use the "renderProductsPreview" tool, do not repeat the preview in the text response after that.
- If a benefit type is unsupported, immediately use the "redirectToManualSetup" tool to redirect the user to the manual setup page. There is no use in collecting more information in that case since they'll have to manually re-enter everything anyway.
- Remember that you are helping the user with their initial setup, you're the first thing they see after signing up, so don't ask for pre-existing information (ID's, meters, …). Assume you'll have to create from scratch.
- Be friendly and helpful if people ask questions like "What is Polar?" or "What can I sell?".

The user will now describe their product and you will start the configuration assistant.
`

async function generateOAT(
  userId: string,
  organizationId: string,
): Promise<string> {
  const requestCookies = await cookies()

  if (requestCookies.has(CONFIG.AUTH_MCP_COOKIE_KEY)) {
    return requestCookies.get(CONFIG.AUTH_MCP_COOKIE_KEY)!.value
  }

  const userSessionToken = requestCookies.get(CONFIG.AUTH_COOKIE_KEY)
  if (!userSessionToken) {
    throw new Error('No user session cookie found')
  }

  const client = await getServerSideAPI()
  const { data, error } = await client.POST('/v1/oauth2/token', {
    body: {
      grant_type: 'web',
      client_id: process.env.MCP_OAUTH2_CLIENT_ID!,
      client_secret: process.env.MCP_OAUTH2_CLIENT_SECRET!,
      session_token: userSessionToken.value,
      sub_type: 'organization',
      sub: organizationId,
      scope: null,
    },
    bodySerializer(body) {
      const fd = new FormData()
      for (const [key, value] of Object.entries(body)) {
        if (value) {
          fd.append(key, value)
        }
      }
      return fd
    },
  })

  if (error) {
    throw new Error('Failed to generate OAT')
  }

  const accessToken = data.access_token

  if (!accessToken) {
    throw new Error('Failed to generate OAT')
  }

  requestCookies.set(CONFIG.AUTH_MCP_COOKIE_KEY, accessToken, {
    httpOnly: true,
    secure: true,
    expires: new Date(Date.now() + data.expires_in * 1000),
  })

  return accessToken
}

async function getMCPClient(userId: string, organizationId: string) {
  try {
    const oat = await generateOAT(userId, organizationId)

    const httpTransport = new StreamableHTTPClientTransport(
      new URL('https://app.getgram.ai/mcp/polar-onboarding-assistant'),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${process.env.GRAM_API_KEY}`,
            'MCP-POLAR-SERVER-URL':
              process.env.GRAM_API_URL ?? process.env.NEXT_PUBLIC_API_URL!,
            'MCP-POLAR-ACCESS-TOKEN': oat,
          },
        },
      },
    )

    const mcpClient = await experimental_createMCPClient({
      transport: httpTransport,
    })

    return mcpClient
  } catch (error) {
    console.error('Failed to create MCP client:', error)
    throw error
  }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const {
    messages,
    organizationId,
    conversationId,
  }: { messages: UIMessage[]; organizationId: string; conversationId: string } =
    await req.json()

  const hasToolAccess = (await cookies()).has(CONFIG.AUTH_MCP_COOKIE_KEY)
  let requiresToolAccess = false
  let requiresManualSetup = false
  let isRelevant = true // assume good faith
  let requiresClarification = true

  if (!organizationId) {
    return new Response('Organization ID is required', { status: 400 })
  }

  let tools = {}

  const lastUserMessages = messages.filter((m) => m.role === 'user').reverse()

  if (lastUserMessages.length === 0) {
    return new Response('No user message found', { status: 400 })
  }

  const userMessage = lastUserMessages
    .slice(0, 5)
    .reverse()
    .map((m) =>
      m.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join(' '),
    )
    .join('\n---\n')

  const geminiLite = phClient
    ? withTracing(google('gemini-2.5-flash-lite'), phClient, {
        posthogDistinctId: user.id,
        posthogTraceId: conversationId,
        posthogGroups: { organization: organizationId },
      })
    : google('gemini-2.5-flash-lite')

  const gemini = phClient
    ? withTracing(google('gemini-2.5-flash'), phClient, {
        posthogDistinctId: user.id,
        posthogTraceId: conversationId,
        posthogGroups: { organization: organizationId },
      })
    : google('gemini-2.5-flash')

  const sonnet = phClient
    ? withTracing(anthropic('claude-sonnet-4-5'), phClient, {
        posthogDistinctId: user.id,
        posthogTraceId: conversationId,
        posthogGroups: { organization: organizationId },
      })
    : anthropic('claude-sonnet-4-5')

  const router = await generateObject({
    model: geminiLite,
    output: 'object',
    schema: z.object({
      isRelevant: z
        .boolean()
        .describe(
          'Whether the user request is relevant to configuring their Polar account',
        ),
      requiresManualSetup: z
        .boolean()
        .describe(
          'Whether the user request requires manual setup due to unsupported benefit types (file download, GitHub, Discord) or too complex configuration',
        ),
      requiresToolAccess: z
        .boolean()
        .describe(
          'Whether MCP access is required to act on the user request (get, create, update, delete products, meters or benefits)',
        ),
      requiresClarification: z
        .boolean()
        .describe(
          'Whether there is enough information to act on the user request or if we need further clarification',
        ),
    }),
    system: routerSystemPrompt,
    prompt: userMessage,
  })

  if (!router.object.isRelevant) {
    isRelevant = false
  } else {
    requiresManualSetup = router.object.requiresManualSetup
    requiresToolAccess = router.object.requiresToolAccess
    requiresClarification = router.object.requiresClarification
  }

  let shouldSetupTools = false

  // If we'll be handling the request agentically
  if (isRelevant && !requiresManualSetup && requiresToolAccess) {
    if (!requiresClarification) {
      // We have enough info to act right away, set up tools
      shouldSetupTools = true
    } else if (lastUserMessages.length >= 5 && hasToolAccess) {
      // Conversation has been going on for a while and we had tool access before
      shouldSetupTools = true
    }
  }

  if (shouldSetupTools) {
    const mcpClient = await getMCPClient(user.id, organizationId)
    tools = await mcpClient.tools()
  }

  const redirectToManualSetup = tool({
    description: 'Request the user to manually configure the product instead',
    inputSchema: z.object({
      reason: z
        .enum(['unsupported_benefit_type', 'tool_call_error', 'user_requested'])
        .describe(
          'The reason why the user should manually configure the product',
        ),
    }),
  })

  const markAsDone = tool({
    description: `Mark the onboarding as done call, this tool once products (and their related benefits) have been fully created.

You can call this tool only once as it will end the onboarding flow, so make sure your work is done.
However, don't specifically ask if the user wants anything else before calling this tool. Use your own judgement
based on the conversation history whether you're done.

`,
    inputSchema: z.object({
      productIds: z
        .array(z.string())
        .describe('The UUIDs of the created products'),
    }),
    execute: async ({ productIds }) => {
      const api = await getServerSideAPI()
      await api.POST('/v1/organizations/{id}/ai-onboarding-complete', {
        params: { path: { id: organizationId } },
      })
      return { success: true, productIds }
    },
  })

  let streamStarted = false

  const result = streamText({
    // Gemini 2.5 Flash for quick & cheap responses, Sonnet 4.5 for better tool usage
    model: shouldSetupTools ? sonnet : gemini,
    tools: {
      redirectToManualSetup,
      ...(!requiresManualSetup ? { markAsDone } : {}), // only allow done if we can actually create products
      ...tools,
    },
    toolChoice: requiresManualSetup
      ? { type: 'tool', toolName: 'redirectToManualSetup' }
      : 'auto',
    messages: [
      {
        role: 'system',
        content: conversationalSystemPrompt,
        providerOptions: shouldSetupTools
          ? {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            }
          : {},
      },
      ...convertToModelMessages(messages),
    ],
    stopWhen: stepCountIs(15),
    experimental_transform: smoothStream(),
    onChunk: () => {
      if (!streamStarted) {
        streamStarted = true
      }
    },
    onFinish: () => {
      if (phClient) {
        phClient.flush()
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
