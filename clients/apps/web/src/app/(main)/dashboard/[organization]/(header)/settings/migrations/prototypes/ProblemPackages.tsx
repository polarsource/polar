'use client'

import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MockSubscriptionRecord } from './mockData'
import { CATEGORY_LABELS } from './recordLabels'
import { getProblemCategoryTotals, getProblemSubscriptions } from './selectors'
import { Metric } from './PrototypePrimitives'

export function ProblemPackages({
  records,
}: {
  records?: MockSubscriptionRecord[]
}) {
  const problems = getProblemSubscriptions(records)
  const totals = getProblemCategoryTotals(records)
  const packages = (Object.keys(totals) as Array<keyof typeof totals>)
    .map((category) => [category, totals[category]] as const)
    .filter(([, count]) => count > 0)

  return (
    <Box flexDirection="column" rowGap="s">
      <Box gap="xl" flexWrap="wrap">
        <Metric label="Problem records" value={problems.length} />
        <Metric label="Issue packages" value={packages.length} />
      </Box>
      {packages.map(([category, count]) => {
        const sample = problems.find((record) => record.category === category)
        return (
          <Box
            key={category}
            alignItems={{ base: 'start', md: 'center' }}
            justifyContent="between"
            gap="m"
            flexWrap="wrap"
            padding="l"
            borderRadius="m"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-secondary"
          >
            <Box flexDirection="column" rowGap="xs" minWidth={0}>
              <Box alignItems="center" columnGap="s">
                <Text variant="body">{CATEGORY_LABELS[category]}</Text>
                <Status status={`${count}`} color="yellow" size="small" />
              </Box>
              <Text variant="caption" color="muted">
                {sample?.title ?? 'Review before transfer'}
              </Text>
            </Box>
            <Text variant="caption">Stay on Stripe until resolved</Text>
          </Box>
        )
      })}
    </Box>
  )
}

export function CustomerActionList() {
  const actions = getProblemSubscriptions().filter(
    (record) =>
      record.issueCode === 'missing_payment_method' ||
      record.issueCode === 'expired_card' ||
      record.issueCode === 'payment_method_requires_reentry',
  )

  return (
    <Box as="ul" flexDirection="column" rowGap="s">
      {actions.map((record) => (
        <Box
          as="li"
          key={record.id}
          flexDirection="column"
          rowGap="xs"
          padding="l"
          borderRadius="m"
          backgroundColor="background-secondary"
        >
          <Text variant="body">{record.customerLabel}</Text>
          <Text variant="caption" color="muted">
            {record.title} · {record.recommendedAction}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
