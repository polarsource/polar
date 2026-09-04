import { shouldShowWebhookSignatureNotice } from '@/utils/webhook/signatureNotice'
import { Status } from '@polar-sh/orbit'

export const WebhookSigningSchemeStatus = ({
  organizationCreatedAt,
  usesStandardWebhookSignature,
}: {
  organizationCreatedAt: string
  usesStandardWebhookSignature: boolean
}) => {
  if (!shouldShowWebhookSignatureNotice(organizationCreatedAt)) {
    return null
  }

  return (
    <Status
      size="small"
      color={usesStandardWebhookSignature ? 'green' : 'gray'}
      status={
        usesStandardWebhookSignature ? 'Standard Webhooks' : 'Legacy signing'
      }
    />
  )
}
