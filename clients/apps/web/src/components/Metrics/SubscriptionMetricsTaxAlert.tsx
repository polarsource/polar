import type { schemas } from '@polar-sh/client'
import { SubscriptionMetricsTaxAlertClient } from './SubscriptionMetricsTaxAlertClient'

const AFFECTED_TAX_BEHAVIORS = new Set<schemas['TaxBehaviorOption']>([
  'location',
  'inclusive',
])

const SUBSCRIPTION_METRICS_TAX_CHANGE_TIMESTAMP = Date.parse(
  '2026-06-23T07:47:00.000Z',
)

interface SubscriptionMetricsTaxAlertProps {
  organization: schemas['Organization']
}

export const SubscriptionMetricsTaxAlert = ({
  organization,
}: SubscriptionMetricsTaxAlertProps) => {
  const shouldShow =
    Date.parse(organization.created_at) <
      SUBSCRIPTION_METRICS_TAX_CHANGE_TIMESTAMP &&
    AFFECTED_TAX_BEHAVIORS.has(organization.default_tax_behavior)

  if (!shouldShow) {
    return null
  }

  return <SubscriptionMetricsTaxAlertClient organizationId={organization.id} />
}
