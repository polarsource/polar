export const WEBHOOK_STANDARD_SIGNATURE_CUTOFF = new Date(
  '2026-09-08T00:00:00.000Z',
)

export function shouldShowWebhookSignatureNotice(
  organizationCreatedAt: string,
): boolean {
  return new Date(organizationCreatedAt) < WEBHOOK_STANDARD_SIGNATURE_CUTOFF
}
