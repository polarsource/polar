import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check } from 'lucide-react'
import { MigrationSteps } from './MigrationSteps'

const READ_SCOPES = [
  'Products and prices',
  'Customers and payment methods',
  'Subscriptions',
  'Discounts and coupons',
]

export function ConnectGuide() {
  return (
    <Box flexDirection="column" rowGap="xl">
      <Box flexDirection="column" rowGap="l">
        <Text variant="label">How it works</Text>
        <MigrationSteps />
      </Box>

      <Box
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      />

      <Box flexDirection="column" rowGap="m">
        <Text variant="label">What we access</Text>
        <Box as="ul" flexDirection="column" rowGap="s">
          {READ_SCOPES.map((scope) => (
            <Box
              as="li"
              key={scope}
              display="flex"
              alignItems="center"
              columnGap="s"
            >
              <Check size={14} strokeWidth={2.5} aria-hidden="true" />
              <Text variant="caption" color="muted">
                {scope}
              </Text>
            </Box>
          ))}
        </Box>
        <Text variant="caption" color="muted">
          Read-only access to your Stripe data, plus one write permission used
          only at the final cutover step, to stop billing the migrated
          subscriptions on Stripe. Card numbers never touch Polar; cards are
          copied Stripe-to-Stripe.
        </Text>
      </Box>
    </Box>
  )
}
