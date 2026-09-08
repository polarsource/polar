'use client'

import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PrototypeAction } from './model'
import { Surface } from './PrototypePrimitives'

export function CurrentConnect({
  act,
}: {
  act: (action: PrototypeAction) => void
}) {
  return (
    <Box
      flexDirection={{ base: 'column', lg: 'row' }}
      gap="xl"
      alignItems="start"
    >
      <Box flex={1} flexDirection="column" rowGap="l" minWidth={0}>
        <Text variant="heading-xs" as="h3">
          Connect your Stripe account
        </Text>
        <Text color="muted" wrap="pretty">
          Paste a Stripe restricted API key so Polar can read your products,
          customers and subscriptions. Nothing changes in Stripe during
          assessment.
        </Text>
        <Box flexDirection="column" rowGap="m">
          <Text variant="label">1. Create a restricted key in Stripe</Text>
          <Text variant="caption" color="muted">
            Name it e.g. &ldquo;Polar migration&rdquo;. Match live or test mode
            to this environment.
          </Text>
          <Text variant="label">
            2. Grant Customers, Products, Prices, Payment methods (Read) and
            Subscriptions (Write)
          </Text>
          <Text variant="caption" color="muted">
            Set everything else to None. Write includes read.
          </Text>
          <Text variant="label">3. Paste the key below</Text>
        </Box>
      </Box>
      <Surface>
        <Box flexDirection="column" rowGap="s">
          <Text variant="label" as="label" htmlFor="current-stripe-key">
            Restricted Stripe key
          </Text>
          <Input
            id="current-stripe-key"
            type="password"
            defaultValue="rk_live_mock_pepy"
          />
        </Box>
        <Box>
          <Button onClick={() => act('create')}>Validate and connect</Button>
        </Box>
      </Surface>
    </Box>
  )
}
