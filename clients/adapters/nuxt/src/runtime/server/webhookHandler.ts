import { handleWebhookPayload } from '@polar-sh/adapter-utils'
import type { WebhooksConfig } from '@polar-sh/adapter-utils'
import { webhooks } from '@polar-sh/sdk/2026-04'
import type { H3Event } from 'h3'
import { getHeader, readRawBody, setResponseStatus } from 'h3'

export const Webhooks = ({
  webhookSecret,
  onPayload,
  entitlements,
  ...eventHandlers
}: WebhooksConfig) => {
  return async (event: H3Event) => {
    const requestBody = await readRawBody(event)

    const webhookHeaders = {
      'webhook-id': getHeader(event, 'webhook-id') ?? '',
      'webhook-timestamp': getHeader(event, 'webhook-timestamp') ?? '',
      'webhook-signature': getHeader(event, 'webhook-signature') ?? '',
    }

    let webhookPayload: webhooks.WebhookPayload

    try {
      webhookPayload = await webhooks.validateEvent(
        requestBody || '',
        webhookHeaders,
        webhookSecret,
      )
    } catch (error) {
      if (error instanceof webhooks.PolarWebhookVerificationError) {
        setResponseStatus(event, 403)
        return { received: false }
      }

      if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
        const received = error.eventType !== null
        setResponseStatus(event, received ? 200 : 400)
        return { received }
      }

      if (error instanceof webhooks.PolarWebhookError) {
        setResponseStatus(event, 400)
        return { received: false }
      }

      throw error
    }

    await handleWebhookPayload(webhookPayload, {
      webhookSecret,
      entitlements,
      onPayload,
      ...eventHandlers,
    })

    return { received: true }
  }
}
