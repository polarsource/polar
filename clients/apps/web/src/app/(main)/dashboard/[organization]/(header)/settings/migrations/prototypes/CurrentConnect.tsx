'use client'

import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ConnectGuide } from '../ConnectGuide'
import { PrototypeAction } from './model'
import { Surface } from './PrototypePrimitives'

export function CurrentConnect({
  act,
}: {
  act: (action: PrototypeAction) => void
}) {
  return (
    <Surface>
      <Text variant="heading-xs" as="h3">
        Connect your Stripe account
      </Text>
      <Text color="muted" wrap="pretty">
        Polar reads your products, customers, and subscriptions. Nothing changes
        in Stripe during assessment.
      </Text>
      <ConnectGuide />
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
  )
}
