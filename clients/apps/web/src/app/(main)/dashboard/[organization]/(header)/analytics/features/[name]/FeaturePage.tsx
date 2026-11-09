'use client'

import { CustomerScatter } from '@/components/FeatureBreakdown/CustomerScatter'
import { FeatureFilters } from '@/components/FeatureBreakdown/FeatureAttention'
import { FeatureCost } from '@/components/FeatureBreakdown/FeatureCost'
import { FeatureDetailSidebar } from '@/components/FeatureBreakdown/FeatureDetailSidebar'
import {
  SidebarInline,
  SidebarPanel,
} from '@/components/FeatureBreakdown/FeatureSidebar'
import { FeatureCustomers } from '@/components/FeatureBreakdown/FeatureCustomers'
import {
  economics,
  formatMarginRate,
  Metric,
} from '@/components/FeatureBreakdown/featureEconomics'
import { FeatureEvents } from '@/components/FeatureBreakdown/FeatureEvents'
import { FeaturePlans } from '@/components/FeatureBreakdown/FeaturePlans'
import { FeatureWidgets } from '@/components/FeatureBreakdown/FeatureWidgets'
import { FeatureSelectionDetail } from '@/components/FeatureBreakdown/FeatureSelectionDetail'
import { useSelection } from '@/components/FeatureBreakdown/useSelection'
import { FeatureSection } from '@/components/FeatureBreakdown/FeatureSection'
import {
  MetricChart,
  MetricPicker,
} from '@/components/FeatureBreakdown/MetricChart'
import { FeaturesRail } from '@/components/FeatureBreakdown/FeaturesRail'
import { useFeature } from '@/components/FeatureBreakdown/useFeature'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useFeatureBreakdown } from '@/hooks/queries/featureBreakdown'
import { schemas } from '@polar-sh/client'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'

export default function FeaturePage({
  organization,
  name,
}: {
  organization: schemas['Organization']
  name: string
}) {
  const { data, range, period, findings, finding, setSegment } = useFeature(
    organization,
    name,
  )
  // The chart spans the whole range, shared with the rail's query; the rest
  // covers the selection in it.
  const { data: ranged } = useFeatureBreakdown(organization.id, {
    ...range.rangePeriod,
    interval: range.interval,
  })
  const chartPeriods =
    ranged?.features.find((feature) => feature.name === name)?.periods ?? []
  const [metric, setMetric] = useState<Metric>('unit_cost')
  const [view, setView] = useState<'customers' | 'events'>('customers')
  // Hovering a customer in the table or the plot highlights it in both.
  const [hovered, setHovered] = useState<string | null>(null)
  const total = data ? economics(data.feature) : null
  const { selection, select } = useSelection()
  const sidebar =
    data &&
    (selection ? (
      <FeatureSelectionDetail
        selection={selection}
        detail={data}
        period={period}
        organizationSlug={organization.slug}
        onSelect={select}
        onClose={() => select(null)}
        fallback={<FeatureDetailSidebar detail={data} />}
      />
    ) : (
      <FeatureDetailSidebar detail={data} />
    ))

  return (
    <DashboardBody
      title={
        <Text as="h1" variant="heading-xxs" truncate>
          {data?.feature.label ?? name}
        </Text>
      }
      header={<MetricPicker value={metric} onChange={setMetric} />}
      wide
      contextViewPlacement="left"
      contextViewTitle="Features"
      contextViewClassName="w-full lg:max-w-[300px] xl:max-w-[300px] h-full overflow-y-hidden"
      contextView={<FeaturesRail organization={organization} selected={name} />}
      detailView={sidebar ? <SidebarPanel>{sidebar}</SidebarPanel> : undefined}
    >
      {data && total && (
        <Box flexDirection="column" rowGap="3xl" paddingBottom="3xl">
          <MetricChart
            periods={chartPeriods}
            range={range}
            metric={metric}
            currency={data.currency}
            caption={
              total.marginRate !== null ? (
                <Text
                  variant="heading-xs"
                  color={total.margin < 0 ? 'danger' : 'muted'}
                  tabularNums
                >
                  {formatMarginRate(total.marginRate)} margin
                </Text>
              ) : (
                total.cost > 0 && (
                  <Text variant="heading-xs" color="muted">
                    No revenue
                  </Text>
                )
              )
            }
          />
          <FeatureWidgets
            organizationId={organization.id}
            organizationSlug={organization.slug}
            name={name}
            period={period}
            currency={data.currency}
          />
          <FeatureCost
            steps={data.steps}
            uses={data.feature.occurrences}
            currency={data.currency}
            selected={selection?.kind === 'step' ? selection.id : null}
            onSelect={(id) => select({ kind: 'step', id })}
          />
          <FeaturePlans
            plans={data.plans}
            currency={data.currency}
            selected={selection?.kind === 'plan' ? selection.id : null}
            onSelect={(id) => select({ kind: 'plan', id })}
          />
          <FeatureSection
            title="Customers"
            action={
              <SegmentedControl<'customers' | 'events'>
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: 'customers', label: 'Customers' },
                  { value: 'events', label: 'Events' },
                ]}
              />
            }
          >
            <FeatureFilters
              findings={findings}
              total={data.customers.length}
              selected={finding?.id ?? null}
              onSelect={setSegment}
            />
            <CustomerScatter
              customers={data.customers}
              currency={data.currency}
              focus={finding?.customers ?? null}
              hovered={hovered}
              onHover={setHovered}
              onSelect={(id) => select({ kind: 'customer', id })}
            />
            {view === 'customers' ? (
              <FeatureCustomers
                customers={
                  finding
                    ? data.customers.filter((c) => finding.customers.has(c))
                    : data.customers
                }
                currency={data.currency}
                hovered={hovered}
                onHover={setHovered}
                selected={selection?.kind === 'customer' ? selection.id : null}
                onSelect={(id) => select({ kind: 'customer', id })}
              />
            ) : (
              <FeatureEvents
                organizationId={organization.id}
                organizationSlug={organization.slug}
                name={name}
                period={period}
                customerIds={
                  finding
                    ? [...finding.customers].flatMap((c) =>
                        c.customer_id ? [c.customer_id] : [],
                      )
                    : null
                }
              />
            )}
          </FeatureSection>
          <SidebarInline>{sidebar}</SidebarInline>
        </Box>
      )}
    </DashboardBody>
  )
}
