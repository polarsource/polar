'use client'

import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { PrototypeAction } from './model'
import { Surface } from './PrototypePrimitives'
import { TOP_ISSUE_CODES } from './recordLabels'
import { getCleanSubscriptions, getProblemSubscriptions } from './selectors'

export function CurrentHandoff({
  act,
}: {
  act: (action: PrototypeAction) => void
}) {
  const prepared = getCleanSubscriptions()
  const remaining = getProblemSubscriptions()
  const topProblems = remaining.filter((record) =>
    TOP_ISSUE_CODES.includes(record.issueCode),
  )
  const [reviewing, setReviewing] = useState(false)

  return (
    <Surface>
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Catalog imported
        </Text>
        <Text variant="caption" color="muted">
          {prepared.length} subscriptions are now in Polar. {remaining.length}{' '}
          with problems stayed on Stripe and were not prepared.
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
        <Button
          variant="secondary"
          aria-expanded={reviewing}
          onClick={() => setReviewing((value) => !value)}
        >
          {reviewing ? 'Hide records' : 'Review records'}
        </Button>
      </Box>

      {reviewing ? (
        <Box
          flexDirection="column"
          rowGap="m"
          padding="m"
          borderRadius="m"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-secondary"
          backgroundColor="background-secondary"
        >
          <Box flexDirection="column" rowGap="xs">
            <Text variant="body">Prepared on Polar</Text>
            <Text variant="caption" color="muted">
              {prepared.length} clean subscriptions were prepared and are ready
              for card movement.
            </Text>
          </Box>
          <Box flexDirection="column" rowGap="xs">
            <Text variant="body">Left on Stripe</Text>
            <Text variant="caption" color="muted">
              {remaining.length} problem subscriptions were not prepared. Top
              requested cases:
            </Text>
            <Box as="ul" flexDirection="column" rowGap="s">
              {topProblems.map((record) => (
                <Box
                  as="li"
                  key={record.id}
                  alignItems="center"
                  columnGap="s"
                  flexWrap="wrap"
                >
                  <Status status={record.title} color="yellow" size="small" />
                  <Text variant="caption" color="muted">
                    {record.customerLabel}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      ) : null}

      <Text variant="caption" color="muted">
        {remaining.length} subscriptions were not prepared. You can still
        prepare them later before cutover.
      </Text>
    </Surface>
  )
}
