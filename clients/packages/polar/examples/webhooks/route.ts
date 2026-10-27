import { polar } from './polar'

// Next.js App Router: app/api/polar/webhooks/route.ts
export const POST = polar.webhooks.app

export const typeErrors = () => [
  // @ts-expect-error 'sales' is a Slack notification, it has no handler
  polar.webhooks.sales,
]
