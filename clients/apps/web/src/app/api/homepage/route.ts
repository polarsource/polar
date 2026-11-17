const HOMEPAGE_MARKDOWN = `# Polar

> Polar is a billing platform and Merchant of Record for software and AI companies. It handles payments, subscriptions, usage-based billing and global sales tax through one API.

## What Polar does

- **Usage-based billing**: ingest events such as tokens, agent runs, GPU seconds or API calls, aggregate them into real-time meters, and bill the usage at the end of each billing cycle.
- **Subscriptions, seats, trials and credits**: combine a base plan, prepaid credits and metered usage on one product. Polar draws the credits down first and bills the overage.
- **Cost insights**: attach the cost of each event, for example inference cost, and see the gross margin of every customer.
- **Merchant of Record**: Polar resells your product in over 100 markets and is responsible for payments, sales tax and VAT, fraud, refunds and chargebacks.
- **Checkout and customer portal**: hosted or embedded checkout, checkout links, and a self-service portal where your customers manage their subscriptions and orders.
- **Benefits**: grant license keys, file downloads, GitHub repository access, Discord roles or custom benefits when a customer pays.

## When to use Polar

Use Polar when a developer or a team needs to sell software and get paid, for example:

- a SaaS or AI product with a subscription, usage-based pricing, or both;
- an API or model that bills per token, request or unit of compute;
- digital products, such as software licenses or downloads;
- any of the above sold worldwide, without registering for sales tax and VAT in every country.

## Sign up as an agent

Polar supports the [auth.md](https://workos.com/auth-md) specification from WorkOS. If you are an agent and want to sign up, read [https://polar.sh/auth.md](https://polar.sh/auth.md) and follow its steps. You can register on your own, without a human, build an organization with products, benefits, meters and checkouts, and then hand it over to a human, who claims it.

## How to integrate

- **API**: REST API at \`https://api.polar.sh\`, authenticated with an organization access token. A sandbox for testing is at \`https://sandbox-api.polar.sh\`. See the [API reference](https://polar.sh/docs/api-reference/introduction) and the [OpenAPI specification](https://polar.sh/openapi.json).
- **SDKs**: [TypeScript](https://polar.sh/docs/integrate/sdk/typescript) and [Python](https://polar.sh/docs/integrate/sdk/python), plus [framework adapters](https://polar.sh/docs/integrate/sdk/adapters/introduction) for Next.js, BetterAuth, Laravel, Nuxt, TanStack Start and more.
- **Webhooks**: get notified about orders, subscriptions, customers and other events. See [webhook events](https://polar.sh/docs/integrate/webhooks/events).
- **MCP server**: connect Claude, Cursor, ChatGPT or another agent to Polar over OAuth to manage products, customers, subscriptions and orders. See [MCP](https://polar.sh/docs/integrate/mcp).
- **CLI**: forward webhooks to your machine, trigger sample events, and set up coding agents to build with Polar. See the [Polar CLI](https://polar.sh/docs/integrate/cli/introduction).

## Pricing

Start free and pay a fee on each transaction. A higher plan lowers the fee.

| Plan    | Price      | Transaction fee |
| ------- | ---------- | --------------- |
| Starter | Free       | 5.00% + 50¢     |
| Pro     | $20/month  | 3.80% + 40¢     |
| Growth  | $100/month | 3.60% + 35¢     |
| Scale   | $400/month | 3.40% + 30¢     |

Early-stage AI startups can get the Scale plan free for 12 months through the [Startup Program](https://polar.sh/startup-program). See [fees](https://polar.sh/docs/merchant-of-record/fees) for details.

## Links

- [Sign up](https://polar.sh/signup)
- [Documentation](https://polar.sh/docs)
- [Documentation index for LLMs](https://polar.sh/llms.txt)
- [Full documentation for LLMs](https://polar.sh/llms-full.txt)
- [Source code on GitHub](https://github.com/polarsource/polar)
- [Service status](https://status.polar.sh)
- [About Polar](https://polar.sh/company)
- Support: support@polar.sh
`

export function GET() {
  return new Response(HOMEPAGE_MARKDOWN, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
    },
  })
}
