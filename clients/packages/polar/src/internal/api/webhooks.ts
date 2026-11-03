import { webhooks } from '../../sdk'

export type VerifiedWebhook =
  | { readonly status: 'verified'; readonly event: webhooks.WebhookPayload }
  | { readonly status: 'invalid_signature' | 'unknown_type' | 'malformed' }

export const verifyWebhook = async (
  request: Request,
  secret: string,
): Promise<VerifiedWebhook> => {
  try {
    const event = await webhooks.validateEvent(
      await request.text(),
      Object.fromEntries(request.headers),
      secret,
    )
    return { status: 'verified', event }
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookVerificationError) {
      return { status: 'invalid_signature' }
    }
    // A null event type means the body had no `type` at all
    if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
      return { status: error.eventType === null ? 'malformed' : 'unknown_type' }
    }
    if (error instanceof webhooks.PolarWebhookError) {
      return { status: 'malformed' }
    }
    throw error
  }
}
