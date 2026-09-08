'use client'

import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PrototypeAction } from './model'
import { Surface } from './PrototypePrimitives'
import { getCleanSubscriptions, getProblemSubscriptions } from './selectors'

export function CurrentHandoff({
  act,
}: {
  act: (action: PrototypeAction) => void
}) {
  const prepared = getCleanSubscriptions().length
  const remaining = getProblemSubscriptions().length

  return (
    <Surface>
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Catalog imported
        </Text>
        <Text variant="caption" color="muted">
          {prepared} subscriptions are now in Polar. {remaining} with problems
          stayed on Stripe and were not prepared.
        </Text>
      </Box>

      <Box
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      />

      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Next: move saved cards
        </Text>
        <Text variant="caption" color="muted">
          Your customers&apos; cards are still at Stripe. Moving them lets Polar
          charge them. This is a checklist. You can leave and come back.
        </Text>
      </Box>

      <Box gap="s" flexWrap="wrap">
        <Button onClick={() => act('resolve')}>Start moving cards</Button>
        <Button variant="secondary" disabled>
          Review records
        </Button>
      </Box>

      <Text variant="caption" color="muted">
        {remaining} subscriptions were not prepared. You can still prepare them
        later before cutover.
      </Text>
    </Surface>
  )
}
