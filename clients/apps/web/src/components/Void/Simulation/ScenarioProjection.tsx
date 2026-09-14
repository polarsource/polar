'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { monthLabel, signedPct, signedUsd, usd } from './format'
import { ScenarioChart } from './ScenarioChart'
import { Assumptions, ProjectionPoint } from './types'

export const ScenarioProjection = ({
  points,
  assumptions,
}: {
  points: ProjectionPoint[]
  assumptions: Assumptions
}) => {
  const last = points[points.length - 1]
  const first = points[0]
  const gross = last.scenario - last.baseline
  const expected = last.expected - last.baseline
  const ratio = last.baseline > 0 ? expected / last.baseline : null

  return (
    <Box flexDirection="column" rowGap="xl">
      <Box flexDirection="column" rowGap="s">
        <Text variant="heading-xs" as="h2">
          Risk-adjusted monthly revenue reaches {usd(last.expected)} in twelve
          months, {signedPct(ratio)} against baseline
        </Text>
        <Text color="muted">
          Gross uplift {signedUsd(gross)} per month, {signedUsd(expected)} after
          expected churn. Existing customers carry the churn risk. The{' '}
          {assumptions.newCustomers} new customers a month only ever see the new
          price. Usage grows {assumptions.usageGrowth}% a month, from{' '}
          {usd(first.baseline)} today.
        </Text>
      </Box>
      <Box
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="l"
        padding="l"
      >
        <ScenarioChart
          data={points}
          keys={[
            { key: 'baseline', label: 'Baseline' },
            { key: 'scenario', label: 'Scenario' },
            { key: 'expected', label: 'Risk-adjusted' },
          ]}
          xAxisFormatter={monthLabel}
        />
      </Box>
    </Box>
  )
}
