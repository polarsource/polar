'use client'

import { shouldShowWebhookSignatureNotice } from '@/utils/webhook/signatureNotice'
import { Alert } from '@polar-sh/orbit'

const DOCS_HREF = 'https://polar.sh/docs/integrate/webhooks/delivery'

export const WebhookSignatureNotice = ({
  organizationCreatedAt,
}: {
  organizationCreatedAt: string
}) => {
  if (!shouldShowWebhookSignatureNotice(organizationCreatedAt)) {
    return null
  }

  return (
    <Alert
      variant="info"
      title="Webhook signature changes"
      description={
        <>
          We're changing how we sign webhook requests starting September 8 2026.
          The new signatures will only apply to new endpoints and new endpoint secrets.
          Before adding new webhook endpoints and/or resetting webhook secrets ensure you've read up
          on the change in <a href={DOCS_HREF} target="_blank" className="underline">our docs</a>.
        </>
      }
    />
  )
}
