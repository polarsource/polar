'use client'

import { useMetricDashboards, useMetrics } from '@/hooks/queries/metrics'
import { METRIC_GROUPS, metricGroupSlug } from '@/utils/metrics'
import { type schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode, useMemo } from 'react'
import { CancellationsContent } from './CancellationsContent'
import { CustomDashboardActions } from './DashboardViewHeader'
import { MetricGroup } from './MetricGroup'
import { SeatsContent } from './SeatsContent'
import { useMetricsFilters } from './useMetricsFilters'

type MetricKey = keyof schemas['Metrics']

interface ClientPageProps {
  organization: schemas['Organization']
  groupSlugs: string[]
  earliestDateISOString: string
}

const DashboardSection = ({
  id,
  title,
  actions,
  children,
}: {
  id: string
  title: string
  actions?: ReactNode
  children: ReactNode
}) => (
  <Box as="section" id={id} flexDirection="column" rowGap="l">
    <Box alignItems="center" justifyContent="between" columnGap="m">
      <Text as="h2" variant="heading-xs">
        {title}
      </Text>
      {actions}
    </Box>
    {children}
  </Box>
)

export default function ClientPage({
  organization,
  groupSlugs,
  earliestDateISOString,
}: ClientPageProps) {
  const organizationId = organization.id
  const { interval, startDate, endDate, productId } = useMetricsFilters(
    earliestDateISOString,
  )
  const { data: customDashboards } = useMetricDashboards(organizationId)

  const groups = useMemo(
    () =>
      METRIC_GROUPS.map((g) => ({
        slug: metricGroupSlug(g.category),
        title: g.category,
        metrics: g.metrics.map((m) => m.slug),
      })).filter(({ slug }) => groupSlugs.includes(slug)),
    [groupSlugs],
  )

  const dashboards = useMemo(
    () =>
      [...(customDashboards ?? [])].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [customDashboards],
  )

  const metrics = useMemo(
    () => [
      ...new Set<MetricKey>([
        ...groups.flatMap((g) => g.metrics),
        ...dashboards.flatMap((d) => d.metrics as MetricKey[]),
      ]),
    ],
    [groups, dashboards],
  )

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organizationId,
    ...(productId && productId.length > 0 ? { product_id: productId } : {}),
    metrics,
  })

  if (!data) {
    return null
  }

  return (
    <Box flexDirection="column" rowGap="4xl">
      {groups.map((group) => (
        <DashboardSection key={group.slug} id={group.slug} title={group.title}>
          {group.slug === 'cancellations' ? (
            <CancellationsContent
              data={data}
              interval={interval}
              organizationId={organizationId}
              startDate={startDate}
              endDate={endDate}
              productId={productId ?? undefined}
            />
          ) : group.slug === 'seats' ? (
            <SeatsContent data={data} interval={interval} />
          ) : (
            <MetricGroup
              metricKeys={group.metrics}
              data={data}
              interval={interval}
            />
          )}
        </DashboardSection>
      ))}
      {dashboards.map((dashboard) => (
        <DashboardSection
          key={dashboard.id}
          id={dashboard.id}
          title={dashboard.name}
          actions={
            <CustomDashboardActions
              organization={organization}
              dashboard={dashboard}
              earliestDateISOString={earliestDateISOString}
            />
          }
        >
          {dashboard.metrics.length === 0 ? (
            <Box
              flexDirection="column"
              alignItems="center"
              paddingVertical="4xl"
              rowGap="s"
              borderRadius="l"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <Text variant="title">No metrics in this dashboard</Text>
              <Text color="muted">Edit this dashboard to add metrics.</Text>
            </Box>
          ) : (
            <MetricGroup
              metricKeys={dashboard.metrics as MetricKey[]}
              data={data}
              interval={interval}
            />
          )}
        </DashboardSection>
      ))}
    </Box>
  )
}
