'use client'

import { MetricGroup } from '@/app/(main)/dashboard/[organization]/(header)/analytics/metrics/components/MetricGroup'
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
import Button from '@polar-sh/ui/components/atoms/Button'
import { Settings2 } from 'lucide-react'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import {
  MetricSelectorModalContent,
  useMetricSelectorModal,
} from './MetricSelectorModal'

export { DEFAULT_OVERVIEW_METRICS }

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
        <div className="flex items-center gap-x-4">
          <div className="dark:bg-polar-800 flex items-center gap-x-1 rounded-xl bg-gray-50 p-1">
            {(Object.entries(CHART_RANGES) as [ChartRange, string][]).map(
              ([key, label]) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={twMerge(
                    'cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium',
                    range === key
                      ? 'dark:bg-polar-600 bg-white text-black shadow-lg dark:text-white'
                      : 'dark:text-polar-500 text-gray-500 hover:text-gray-900 dark:hover:text-white',
                  )}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <Button
            type="button"
            onClick={show}
            variant="secondary"
            size="sm"
            wrapperClassNames="gap-x-2"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Customize
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
