import { Predicate } from 'effect'
import type { HandledWebhookEndpoint, WebhookHandler } from '../schema/webhook'
import { verifyWebhook } from '../internal/api/webhooks'

export type WebhookRoute = (request: Request) => Promise<Response>

const accepted = () => new Response(null, { status: 202 })

// Read through globalThis so the package doesn't depend on Node's types
const readEnv = (name: string): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name]

const resolveHandler = (key: string, loaded: unknown): WebhookHandler => {
  if (typeof loaded === 'function') return loaded as WebhookHandler
  if (
    Predicate.hasProperty(loaded, 'default') &&
    typeof loaded.default === 'function'
  ) {
    return loaded.default as WebhookHandler
  }
  throw new Error(
    `The handler for webhook "${key}" must resolve to a function or a module whose default export is one.`,
  )
}

export const createWebhookRoute = (
  key: string,
  endpoint: HandledWebhookEndpoint,
): WebhookRoute => {
  const events = new Set<string>(endpoint.events)
  let handler: Promise<WebhookHandler> | undefined

  const load = () => {
    handler ??= endpoint.handler().then(
      (loaded) => resolveHandler(key, loaded),
      (error: unknown) => {
        handler = undefined
        throw error
      },
    )
    return handler
  }

  return async (request) => {
    const secret = readEnv(endpoint.secretEnv)
    if (!secret) {
      throw new Error(
        `Webhook "${key}" needs its signing secret in the ${endpoint.secretEnv} environment variable.`,
      )
    }

    const verified = await verifyWebhook(request, secret)
    switch (verified.status) {
      case 'invalid_signature':
        return new Response(null, { status: 403 })
      case 'malformed':
        return new Response(null, { status: 400 })
      // Newer event types, or ones subscribed to outside the config, are
      // acknowledged so Polar doesn't retry them.
      case 'unknown_type':
        return accepted()
    }
    const { event } = verified

    if (!events.has(event.type)) return accepted()

    // A throwing handler surfaces as a 5xx, so Polar redelivers the event.
    const handle = await load()
    await handle(event)
    return accepted()
  }
}
