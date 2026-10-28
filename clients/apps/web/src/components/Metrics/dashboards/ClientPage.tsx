'use client'

import { useMetricDashboards, useMetrics } from '@/hooks/queries/metrics'
import { METRIC_GROUPS, metricGroupSlug } from '@/utils/metrics'
import { type schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { parseAsString, useQueryState } from 'nuqs'
import { ReactNode, useEffect, useMemo } from 'react'
import { CancellationsContent } from './CancellationsContent'
import { CustomDashboardActions } from './DashboardViewHeader'
import { MetricGroup } from './MetricGroup'
import { SeatsContent } from './SeatsContent'
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

const useFilteredMetrics = (
  organizationId: string,
  earliestDateISOString: string,
  metrics: MetricKey[],
) => {
  const { interval, startDate, endDate, productId } = useMetricsFilters(
    earliestDateISOString,
  )
  const { data } = useMetrics(
    {
      startDate,
      endDate,
      interval,
      organization_id: organizationId,
      ...(productId && productId.length > 0 ? { product_id: productId } : {}),
      metrics,
    },
    metrics.length > 0,
  )
  return { data, interval, startDate, endDate, productId }
}

// Each built-in group queries its own metrics, so the page renders section by
// section instead of waiting on one request for every metric.
const BuiltInGroupSection = ({
  organizationId,
  group,
  earliestDateISOString,
}: {
  organizationId: string
  group: MetricGroupDefinition
  earliestDateISOString: string
}) => {
  const { data, interval, startDate, endDate, productId } = useFilteredMetrics(
    organizationId,
    earliestDateISOString,
    group.metrics,
  )

  return (
    <DashboardSection id={group.slug} title={group.title}>
      {!data ? (
        <MetricGroup metricKeys={group.metrics} interval={interval} loading />
      ) : group.slug === 'cancellations' ? (
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
  )
}

// Each custom dashboard queries its own metrics, so a dashboard holding a slug
// the metrics endpoint rejects only breaks its own section.
const CustomDashboardSection = ({
  organization,
  dashboard,
  earliestDateISOString,
}: {
  organization: schemas['Organization']
  dashboard: schemas['MetricDashboardSchema']
  earliestDateISOString: string
}) => {
  const metricKeys = dashboard.metrics as MetricKey[]
  const { data, interval } = useFilteredMetrics(
    organization.id,
    earliestDateISOString,
    metricKeys,
  )

  return (
    <DashboardSection
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
        <MetricGroup metricKeys={metricKeys} data={data} interval={interval} />
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
  const [section, setSection] = useQueryState('section', parseAsString)
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

  useEffect(() => {
    if (!section) return
    const target = document.getElementById(section)
    if (!target) return
    target.scrollIntoView({ block: 'start' })
    setSection(null)
  }, [section, dashboards, setSection])

  return (
    <Box flexDirection="column" rowGap="4xl">
      {groups.map((group) => (
        <BuiltInGroupSection
          key={group.slug}
          organizationId={organizationId}
          group={group}
          earliestDateISOString={earliestDateISOString}
        />
      ))}
      {dashboards.map((dashboard) => (
        <CustomDashboardSection
          key={dashboard.id}
          organization={organization}
          dashboard={dashboard}
          earliestDateISOString={earliestDateISOString}
        />
      ))}
    </Box>
  )
}
