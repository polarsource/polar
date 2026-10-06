'use client'

import { Alert, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { useMemo } from 'react'
import { useSimulationCustomers } from './customers'
import { project, replay } from './engine'
import { ScenarioCustomers } from './ScenarioCustomers'
import { ScenarioProjection } from './ScenarioProjection'
import { ScenarioReplay } from './ScenarioReplay'
import type { ScenarioLevers } from './types'

export const StageSimulation = ({
  organizationId,
  organizationSlug,
  levers,
  baseLevers,
  dirty,
}: {
  organizationId: string
  organizationSlug: string
  levers: ScenarioLevers
  baseLevers: ScenarioLevers
  dirty: boolean
}) => {
  const customers = useSimulationCustomers(organizationId, [
    { levers, baseLevers },
  ])
  const results = useMemo(
    () =>
      customers.data
        ? {
            replay: replay(levers, baseLevers, customers.data),
            projection: project(levers, baseLevers, customers.data),
          }
        : null,
    [levers, baseLevers, customers.data],
  )

  return (
    <Box
      as="section"
      aria-label="Simulation"
      flexDirection="column"
      rowGap="2xl"
    >
      <Box flexDirection="column" rowGap="xs">
        <Text as="h2" variant="heading-xs">
          Simulation
        </Text>
        <Text color="muted" variant="caption">
          {dirty
            ? 'The last 30 days replayed with the staged configuration and your unsaved lever changes'
            : 'The last 30 days replayed with the staged configuration'}
        </Text>
      </Box>
      {customers.error ? (
        <Alert
          variant="danger"
          title="Could not run the simulation"
          description={customers.error.message}
        />
      ) : !results ? (
        <LoadingBox height={240} borderRadius="m" />
      ) : (
        <>
          <ScenarioReplay result={results.replay} />
          <ScenarioCustomers
            result={results.replay}
            base={`/void/dashboard/${organizationSlug}`}
          />
          <ScenarioProjection
            points={results.projection}
            assumptions={levers.assumptions}
          />
        </>
      )}
    </Box>
  )
}
