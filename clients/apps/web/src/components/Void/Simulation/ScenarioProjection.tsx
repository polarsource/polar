'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { monthLabel } from './format'
import { ScenarioChart } from './ScenarioChart'
import { SeriesLegend } from './SeriesLegend'
import { Assumptions, ProjectionPoint } from './types'

export const ScenarioProjection = ({
  points,
  assumptions,
}: {
  points: ProjectionPoint[]
  assumptions: Assumptions
}) => {
  const last = points[points.length - 1]

  return (
    <Box flexDirection="column" rowGap="xl">
      <Box alignItems="baseline" justifyContent="between" columnGap="l">
        <Text variant="heading-xxs" as="h2">
          Projection
        </Text>
        <Text color="muted">
          {assumptions.usageGrowth}% usage growth, {assumptions.newCustomers}{' '}
          new customers a month
        </Text>
      </Box>
      <Box
        flexDirection="column"
        rowGap="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="l"
        padding="l"
      >
        <SeriesLegend
          values={{
            baseline: last.baseline,
            scenario: last.scenario,
            expected: last.expected,
          }}
        />
        <ScenarioChart
          data={points}
          keys={['baseline', 'scenario', 'expected']}
          xAxisFormatter={monthLabel}
        />
      </Box>
    </Box>
  )
}
