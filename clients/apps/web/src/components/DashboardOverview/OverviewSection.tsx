'use client'

import { MetricGroup } from '@/components/Metrics/dashboards/MetricGroup'
import { Modal } from '@/components/Modal'
import { useMetrics } from '@/hooks/queries'
import { useChartRange } from '@/hooks/useChartRange'
import {
  ALL_METRICS,
  CHART_RANGES,
  ChartRange,
  DEFAULT_OVERVIEW_METRICS,
  getChartRangeParams,
} from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { SegmentedControl } from '@polar-sh/orbit'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Settings2 } from 'lucide-react'
import React from 'react'
import {
  MetricSelectorModalContent,
  useMetricSelectorModal,
} from './MetricSelectorModal'

interface OverviewSectionProps {
  organization: schemas['Organization']
}

export function OverviewSection({ organization }: OverviewSectionProps) {
  const { range, setRange } = useChartRange(organization.id)
  const { isShown, show, hide } = useMetricSelectorModal()

  const initialMetrics = React.useMemo<(keyof schemas['Metrics'])[]>(() => {
    const stored = organization.feature_settings?.overview_metrics
    if (stored?.length === 5) {
      return stored.filter((slug) =>
        ALL_METRICS.some((m) => m.slug === slug),
      ) as (keyof schemas['Metrics'])[]
    }
    return DEFAULT_OVERVIEW_METRICS
  }, [organization.feature_settings?.overview_metrics])

  const [activeMetrics, setActiveMetrics] =
    React.useState<(keyof schemas['Metrics'])[]>(initialMetrics)

  const [startDate, endDate, interval] = React.useMemo(
    () => getChartRangeParams(range, organization.created_at),
    [range, organization.created_at],
  )

  const { data, isLoading } = useMetrics({
    organization_id: organization.id,
    startDate,
    endDate,
    interval,
    metrics: activeMetrics,
  })

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-medium text-gray-900 dark:text-white">
          Overview
        </h2>
        <div className="flex items-center justify-between md:gap-x-4">
          <SegmentedControl
            options={(
              Object.entries(CHART_RANGES) as [ChartRange, string][]
            ).map(([value, label]) => ({ value, label }))}
            value={range}
            onChange={setRange}
          />
          <Button
            type="button"
            onClick={show}
            variant="secondary"
            size="sm"
            wrapperClassNames="gap-x-2"
            aria-label="Customize"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Customize</span>
          </Button>
        </div>
      </div>
      <MetricGroup
        data={data}
        metricKeys={activeMetrics}
        interval={interval}
        loading={isLoading}
      />
      <Modal
        title="Customize Overview Metrics"
        isShown={isShown}
        hide={hide}
        modalContent={
          <MetricSelectorModalContent
            organization={organization}
            activeMetrics={activeMetrics}
            onSave={(slugs) => {
              setActiveMetrics(slugs)
              hide()
            }}
          />
        }
      />
    </div>
  )
}
