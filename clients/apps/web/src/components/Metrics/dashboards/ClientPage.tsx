'use client'

import { useMetricDashboards, useMetrics } from '@/hooks/queries/metrics'
import { METRIC_GROUPS, metricGroupSlug } from '@/utils/metrics'
import { type schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode, Ref, useMemo } from 'react'
import { CancellationsContent } from './CancellationsContent'
import { CustomDashboardActions } from './DashboardViewHeader'
import { MetricGroup } from './MetricGroup'
import { SeatsContent } from './SeatsContent'
import { useDeepLinkedSection } from './useDeepLinkedSection'
import { useHasBeenSeen } from './useHasBeenSeen'
import { useMetricsFilters } from './useMetricsFilters'

type MetricKey = keyof schemas['Metrics']

interface MetricGroupDefinition {
  slug: string
  title: string
  metrics: MetricKey[]
}

interface ClientPageProps {
  organization: schemas['Organization']
  groupSlugs: string[]
  earliestDateISOString: string
}

const DashboardSection = ({
  ref,
  id,
  title,
  actions,
  children,
}: {
  ref: Ref<HTMLElement>
  id: string
  title: string
  actions?: ReactNode
  children: ReactNode
}) => (
  <Box as="section" ref={ref} id={id} flexDirection="column" rowGap="l">
    <Box alignItems="center" justifyContent="between" columnGap="m">
      <Text as="h2" variant="heading-xs">
        {title}
      </Text>
      {actions}
    </Box>
    {children}
  </Box>
)

const useFilteredMetrics = (
  organizationId: string,
  earliestDateISOString: string,
  metrics: MetricKey[],
  enabled: boolean,
) => {
  const { interval, startDate, endDate, productFilter } = useMetricsFilters(
    earliestDateISOString,
  )
  const { data } = useMetrics(
    {
      startDate,
      endDate,
      interval,
      organization_id: organizationId,
      ...productFilter,
      metrics,
    },
    enabled && metrics.length > 0,
  )
  return { data, interval, startDate, endDate, productFilter }
}

// Each built-in group queries its own metrics once it nears the viewport, so
// the page only requests the sections the user actually scrolls to.
const BuiltInGroupSection = ({
  organizationId,
  group,
  earliestDateISOString,
  deepLinked,
}: {
  organizationId: string
  group: MetricGroupDefinition
  earliestDateISOString: string
  deepLinked: boolean
}) => {
  const { ref, seen } = useHasBeenSeen<HTMLElement>()
  const { data, interval, startDate, endDate, productFilter } =
    useFilteredMetrics(
      organizationId,
      earliestDateISOString,
      group.metrics,
      seen || deepLinked,
    )

  return (
    <DashboardSection ref={ref} id={group.slug} title={group.title}>
      {!data ? (
        <MetricGroup metricKeys={group.metrics} interval={interval} loading />
      ) : group.slug === 'cancellations' ? (
        <CancellationsContent
          data={data}
          interval={interval}
          organizationId={organizationId}
          startDate={startDate}
          endDate={endDate}
          productFilter={productFilter}
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
  )
}

// Each custom dashboard queries its own metrics, so a dashboard holding a slug
// the metrics endpoint rejects only breaks its own section.
const CustomDashboardSection = ({
  organization,
  dashboard,
  earliestDateISOString,
  deepLinked,
}: {
  organization: schemas['Organization']
  dashboard: schemas['MetricDashboardSchema']
  earliestDateISOString: string
  deepLinked: boolean
}) => {
  const metricKeys = dashboard.metrics as MetricKey[]
  const { ref, seen } = useHasBeenSeen<HTMLElement>()
  const { data, interval } = useFilteredMetrics(
    organization.id,
    earliestDateISOString,
    metricKeys,
    seen || deepLinked,
  )

  return (
    <DashboardSection
      ref={ref}
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
      {metricKeys.length === 0 ? (
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
          metricKeys={metricKeys}
          data={data}
          interval={interval}
          loading={!data}
        />
      )}
    </DashboardSection>
  )
}

export default function ClientPage({
  organization,
  groupSlugs,
  earliestDateISOString,
}: ClientPageProps) {
  const organizationId = organization.id
  const { data: customDashboards } = useMetricDashboards(organizationId)

  const groups = useMemo<MetricGroupDefinition[]>(() => {
    const enabledSlugs = new Set(groupSlugs)
    return METRIC_GROUPS.map((g) => ({
      slug: metricGroupSlug(g.category),
      title: g.category,
      metrics: g.metrics.map((m) => m.slug),
    })).filter(({ slug }) => enabledSlugs.has(slug))
  }, [groupSlugs])

  const dashboards = useMemo(
    () =>
      [...(customDashboards ?? [])].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [customDashboards],
  )

  const section = useDeepLinkedSection(dashboards.map(({ id }) => id))

  return (
    <Box flexDirection="column" rowGap="4xl">
      {groups.map((group) => (
        <BuiltInGroupSection
          key={group.slug}
          organizationId={organizationId}
          group={group}
          earliestDateISOString={earliestDateISOString}
          deepLinked={section === group.slug}
        />
      ))}
      {dashboards.map((dashboard) => (
        <CustomDashboardSection
          key={dashboard.id}
          organization={organization}
          dashboard={dashboard}
          earliestDateISOString={earliestDateISOString}
          deepLinked={section === dashboard.id}
        />
      ))}
    </Box>
  )
}
