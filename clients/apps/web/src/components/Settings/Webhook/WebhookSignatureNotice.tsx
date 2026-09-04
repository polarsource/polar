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
      title="Webhook signatures"
      description={
        <>
          New endpoints and reset secrets use Standard Webhooks from 8 September
          2026, 00:00 UTC. Read the{' '}
          <a
            href={DOCS_HREF}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            delivery docs
          </a>{' '}
          before you add an endpoint or reset a secret.
        </>
      }
    />
  )
}
