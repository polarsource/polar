'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext, useMemo } from 'react'
import { useVoidDataSource } from './dataSource'
import { VoidReducerMetric } from './identityLive'
import { useVoidReducerMetrics } from './metricQueries'
import { getVoidReducerMetrics } from './mock'
import { VoidReducerMetrics } from './VoidReducerMetrics'

export function VoidMetricsPage() {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const query = useVoidReducerMetrics(organization.id, { enabled: live })
  const fixtures = useMemo(() => getVoidReducerMetrics(), [])

  return (
    <DashboardBody
      title="Metrics"
      header={
        <Text color="muted" variant="heading-xs">
          Last 30 days, daily · UTC
        </Text>
      }
    >
      <MetricsBody
        loading={live && query.isLoading}
        error={live ? query.error : null}
        metrics={live ? (query.data ?? []) : fixtures}
      />
    </DashboardBody>
  )
}

function MetricsBody({
  loading,
  error,
  metrics,
}: {
  loading: boolean
  error: Error | null
  metrics: VoidReducerMetric[]
}) {
  if (loading) {
    return (
      <Box height={180} borderRadius="m" backgroundColor="background-card" />
    )
  }

  if (error) {
    return (
      <Box
        borderRadius="m"
        backgroundColor="background-warning"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-warning"
        padding="l"
      >
        <Text>{error.message}</Text>
      </Box>
    )
  }

  if (metrics.length === 0) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingVertical="3xl"
        rowGap="l"
      >
        <Text variant="heading-xs" color="muted">
          No scalar reducers
        </Text>
        <Text variant="body" color="muted">
          Create a scalar reducer to chart its daily values here.
        </Text>
      </Box>
    )
  }

  return <VoidReducerMetrics metrics={metrics} />
}
