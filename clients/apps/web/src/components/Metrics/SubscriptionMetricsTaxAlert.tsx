import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const AFFECTED_TAX_BEHAVIORS = new Set<schemas['TaxBehaviorOption']>([
  'location',
  'inclusive',
])

interface OrganizationWithTaxBehavior {
  organization: Pick<schemas['Organization'], 'default_tax_behavior'>
}

export const shouldShowSubscriptionMetricsTaxAlert = ({
  default_tax_behavior,
}: OrganizationWithTaxBehavior['organization']) => {
  return AFFECTED_TAX_BEHAVIORS.has(default_tax_behavior)
}

export const SubscriptionMetricsTaxAlert = () => {
  return (
    <Box
      flexDirection={'column'}
      rowGap="xs"
      borderRadius="l"
      backgroundColor="background-card"
      padding="l"
    >
      <Text as="strong">Subscription metrics now exclude tax</Text>
      <Box>
        <Text color="muted">
          We corrected subscription metrics to be tax-exclusive, matching your
          revenue metrics. Because your organization uses location-based or
          inclusive tax behavior, these subscription metrics may be a bit lower
          than before.
        </Text>
      </Box>
    </Box>
  )
}
