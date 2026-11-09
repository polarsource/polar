'use client'

import {
  economics,
  FeaturePeriod,
  formatMarginRate,
  Metric,
  sumPeriods,
} from '@/components/FeatureBreakdown/featureEconomics'
import { FeatureList } from '@/components/FeatureBreakdown/FeatureList'
import { FeatureScatter } from '@/components/FeatureBreakdown/FeatureScatter'
import { FeatureSection } from '@/components/FeatureBreakdown/FeatureSection'
import { FeaturesOverviewSidebar } from '@/components/FeatureBreakdown/FeaturesOverviewSidebar'
import {
  SidebarInline,
  SidebarPanel,
} from '@/components/FeatureBreakdown/FeatureSidebar'
import {
  MetricChart,
  MetricPicker,
} from '@/components/FeatureBreakdown/MetricChart'
import { FeaturesRail } from '@/components/FeatureBreakdown/FeaturesRail'
import { useFeatureRange } from '@/components/FeatureBreakdown/useFeatureRange'
import { useRailState } from '@/components/FeatureBreakdown/useRailState'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useFeatureBreakdown } from '@/hooks/queries/featureBreakdown'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChartNoAxesColumn } from '@polar-sh/orbit/icons'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

const combine = (features: schemas['FeatureSummary'][]): FeaturePeriod[] => {
  const byTimestamp = new Map<string, FeaturePeriod[]>()
  for (const feature of features) {
    for (const period of feature.periods) {
      byTimestamp.set(period.timestamp, [
        ...(byTimestamp.get(period.timestamp) ?? []),
        period,
      ])
    }
  }
  return [...byTimestamp.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, periods]) => {
      const sum = sumPeriods(periods)
      return {
        ...sum,
        timestamp,
        cost: String(sum.cost),
        revenue: String(sum.revenue),
      }
    })
}

export default function FeaturesPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const range = useFeatureRange(organization)
  const [metric, setMetric] = useState<Metric>('cost')
  // Hovering a feature in the table or the plot highlights it in both.
  const [hovered, setHovered] = useState<string | null>(null)
  // The chart spans the whole range; the rest covers the selection in it.
  const { data: ranged } = useFeatureBreakdown(organization.id, {
    ...range.rangePeriod,
    interval: range.interval,
  })
  const { data, isLoading } = useFeatureBreakdown(organization.id, {
    ...range.period,
    interval: range.interval,
  })

  const all = data?.features ?? []
  const [{ all: showAll }] = useRailState()
  const withCost = all.filter(
    (feature) => Number(feature.cost) > 0 || Number(feature.revenue) > 0,
  )
  const untracked = showAll ? 0 : all.length - withCost.length
  const tracked = showAll ? all : withCost
  const currency = data?.currency ?? 'usd'
  const total = data ? economics(data) : null
  const searchParams = useSearchParams()
  const featureHref = (name: string) =>
    `/dashboard/${organization.slug}/analytics/features/${encodeURIComponent(name)}${searchParams.size > 0 ? `?${searchParams}` : ''}`

  return (
    <DashboardBody
      title={
        <Text as="h1" variant="heading-xxs">
          Features
        </Text>
      }
      header={<MetricPicker value={metric} onChange={setMetric} />}
      wide
      contextViewPlacement="left"
      contextViewTitle="Features"
      contextViewClassName="w-full lg:max-w-[300px] xl:max-w-[300px] h-full overflow-y-hidden"
      contextView={<FeaturesRail organization={organization} selected={null} />}
      detailView={
        data ? (
          <SidebarPanel>
            <FeaturesOverviewSidebar
              breakdown={data}
              featureHref={featureHref}
            />
          </SidebarPanel>
        ) : undefined
      }
    >
      {!isLoading && all.length === 0 ? (
        <EmptyState
          icon={<ChartNoAxesColumn />}
          title="No feature usage"
          description="No events in this period"
        />
      ) : (
        <Box flexDirection="column" rowGap="3xl" paddingBottom="3xl">
          {data && total && (
            <MetricChart
              periods={combine(ranged?.features ?? [])}
              range={range}
              metric={metric}
              currency={currency}
              caption={
                total.marginRate !== null && (
                  <Text variant="heading-xs" color="muted" tabularNums>
                    {formatMarginRate(total.marginRate)} margin
                  </Text>
                )
              }
            />
          )}
          <FeatureSection title="Features">
            <FeatureScatter
              features={withCost}
              currency={currency}
              hovered={hovered}
              onHover={setHovered}
              featureHref={featureHref}
            />
            <FeatureList
              features={tracked}
              currency={currency}
              featureHref={featureHref}
              hovered={hovered}
              onHover={setHovered}
            />
            {untracked > 0 && (
              <Text color="muted">
                {untracked === 1
                  ? '1 feature without cost or revenue'
                  : `${untracked} features without cost or revenue`}
              </Text>
            )}
          </FeatureSection>
          {data && (
            <SidebarInline>
              <FeaturesOverviewSidebar
                breakdown={data}
                featureHref={featureHref}
              />
            </SidebarInline>
          )}
        </Box>
      )}
    </DashboardBody>
  )
}
