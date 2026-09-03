import {
  type WebhooksConfig,
  handleWebhookPayload,
} from '@polar-sh/adapter-utils'
import { webhooks } from '@polar-sh/sdk/2026-04'
import type { StartRouteHandler } from '../types'

export {
  EntitlementStrategy,
  Entitlements,
  type EntitlementContext,
  type EntitlementHandler,
  type EntitlementProperties,
} from '@polar-sh/adapter-utils'

export const Webhooks = <TPath extends string = string>({
  webhookSecret,
  entitlements,
  onPayload,
  ...eventHandlers
}: WebhooksConfig): StartRouteHandler<TPath> => {
  return async ({ request }) => {
    const requestBody = await request.text()

    const webhookHeaders = {
      'webhook-id': request.headers.get('webhook-id') ?? '',
      'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': request.headers.get('webhook-signature') ?? '',
    }

    let webhookPayload: webhooks.WebhookPayload
    try {
      webhookPayload = await webhooks.validateEvent(
        requestBody,
        webhookHeaders,
        webhookSecret,
      )
    } catch (error) {
      if (error instanceof webhooks.PolarWebhookVerificationError) {
        return Response.json({ received: false }, { status: 403 })
      }

      if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
        return Response.json(
          { received: error.eventType !== null },
          { status: error.eventType !== null ? 200 : 400 },
        )
      }

      if (error instanceof webhooks.PolarWebhookError) {
        return Response.json({ received: false }, { status: 400 })
      }

      throw error
    }

    await handleWebhookPayload(webhookPayload, {
      webhookSecret,
      entitlements,
      onPayload,
      ...eventHandlers,
    })

    return Response.json({ received: true })
  }
}
