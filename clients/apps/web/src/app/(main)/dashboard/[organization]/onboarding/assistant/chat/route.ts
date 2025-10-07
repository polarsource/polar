import { getServerSideAPI } from '@/utils/client/serverside'
import { CONFIG } from '@/utils/config'
import { getAuthenticatedUser } from '@/utils/user'
import { openai } from '@ai-sdk/openai'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
  convertToModelMessages,
  experimental_createMCPClient,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from 'ai'
import { cookies } from 'next/headers'
import { z } from 'zod'

export const maxDuration = 30

const systemPrompt = `
You are a helpful assistant that helps a new user configure their Polar account.
You're part of their onboarding flow, where you'll guide them through collecting the necessary information
of what they're going to be selling on Polar. Once all required information is collected,
you'll be able to configure their account using some tools provided to you.

# About Polar
Polar acts a Merchant of Record, handling international sales taxes and other cumbersome compliance administration,
so that users can focus on building their product and business.

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
You will not be able to configure Discord invites or GitHub repository access for now, since the user has to
authenticate with these third party services before being able to set up a benefit. That's impossible from this chat.

If so, you can use the "redirect_to_manual_setup" tool to redirect the user to the manual setup page.

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

Trials can be granted to any product for a number of days/weeks/months/year.

### Product Configuration

As mentioned before, products can be configured to grant one or more benefits (also sometimes called "entitlements").

So, in general, you should follow this order:

 - Define meters first if there are any usage-based pricing components
 - Define benefits that should be granted
 - Define products

# Rules
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
- If only a monthly recurring price is mentioned, ask if they also want to offer the same product at a yearly recurring price. However, continue with the preview already if relevant.
- If only a yearly recurring price is mentioned, ask if they also want to offer the same product at a monthly recurring price. However, continue with the preview already if relevant.
- If a user mentions "$x per month" for a yearly plan, or vice versa, do the math for them.
- If a recurring price is mentioned without product specifics, assume it's a software subscription.
- If a price is mentioned without a recurring interval, it's a one-time purchase and you should try to determine whether it's a specific benefit or a generic access through a custom benefit
- If the request is not relevant to the configuration of a product, gently decline the request and mention that you're only able to configure the user's Polar account.
- Do not ask for extra benefits, you're just converting a user's description into a configuration.
- Do not ask explicitly if they also want to include a trial. You support trials when asked, but do not propose it yourself.
- Be eager to resolve the request as quickly as possible.
- If you use the "renderProductsPreview" tool, do not repeat the preview in the text response after that.
- If a benefit type is unsupported, immediately use the "redirectToManualSetup" tool to redirect the user to the manual setup page. There is no use in collecting more information in that case since they'll have to manually re-enter everything anyway.

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
    console.error('Failed to generate OAT:', error)
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

    console.log('Attempting to connect to MCP server:', process.env.GRAM_URL)
    console.log(
      'Using API key:',
      process.env.GRAM_API_KEY?.substring(0, 20) + '...',
    )
    console.log('Using OAT:', oat)

    const httpTransport = new StreamableHTTPClientTransport(
      new URL(process.env.GRAM_URL!),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${process.env.GRAM_API_KEY}`,
            'MCP-POLAR-DEV-PIETER-ACCESS-TOKEN': oat,
          },
        },
      },
    )

    const mcpClient = await experimental_createMCPClient({
      transport: httpTransport,
    })

    console.log('MCP client created successfully')
    return mcpClient
  } catch (error) {
    console.error('Failed to create MCP client:', error)
    throw error
  }
}

export async function POST(req: Request) {
  // Get authenticated user
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const {
    messages,
    organizationId,
  }: { messages: UIMessage[]; organizationId: string } = await req.json()

  if (!organizationId) {
    return new Response('Organization ID is required', { status: 400 })
  }

  const mcpClient = await getMCPClient(user.id, organizationId)
  const tools = await mcpClient.tools()

  const redirectToManualSetup = tool({
    description: 'Request the user to manually configure the product instead',
    inputSchema: z.object({
      reason: z
        .enum(['unsupported_benefit_type', 'tool_call_error'])
        .describe(
          'The reason why the user should manually configure the product',
        ),
    }),
  })

  const renderProductsPreview = tool({
    description:
      'Render a preview of the product you are about to configure. This will render the product preview in the UI and is cleaner than a text description.',
    inputSchema: z.object({
      products: z.array(
        z.object({
          name: z.string().describe('The name of the product'),
          description: z
            .string()
            .optional()
            .describe(
              'The description of the product. Only include if explicitly included, probably not needed.',
            ),
          priceInCents: z
            .number()
            .describe('The price of the product in cents in USD'),
          priceType: z
            .enum(['one_time', 'recurring_monthly', 'recurring_yearly'])
            .describe('The type of the price'),
          trialInterval: z
            .enum(['day', 'week', 'month', 'year'])
            .optional()
            .describe('The trial interval'),
          trialIntervalCount: z
            .number()
            .optional()
            .describe('The trial interval count'),
          benefits: z
            .array(
              z.object({
                type: z
                  .enum([
                    'license_key',
                    'file_download',
                    'github_repository_access',
                    'discord_server_access',
                    'meter_credit',
                    'custom',
                  ])
                  .describe('The type of the benefit'),
                name: z
                  .string()
                  .optional()
                  .describe('The description of the benefit'),
              }),
            )
            .optional(),
          usageBasedBilling: z
            .array(
              z.object({
                meterName: z.string().describe('The name of the meter'),
                unitAmount: z
                  .number()
                  .describe('The unit amount in cents in USD'),
                capAmount: z
                  .number()
                  .optional()
                  .describe('The cap amount in cents in USD'),
              }),
            )
            .optional(),
        }),
      ),
    }),
    execute: () => {
      return {
        shown: true,
      }
    },
  })

  const result = streamText({
    model: openai('gpt-5-mini'),
    system: systemPrompt,
    tools: {
      redirectToManualSetup,
      renderProductsPreview,
      ...tools,
    },
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    experimental_transform: smoothStream(),
  })

  return result.toUIMessageStreamResponse()
}
