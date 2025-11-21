'use client'

import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import { schemas } from '@polar-sh/client'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { getSearchParams } from './utils'

interface SpansSidebarProps {
  organization: schemas['Organization']
  hierarchyStats: schemas['ListStatisticsTimeseries'] | undefined
  dateRange: { from: Date; to: Date }
  interval: schemas['TimeInterval']
  startDate: Date
  endDate: Date
  onDateRangeChange: (dateRange: { from: Date; to: Date }) => void
  onIntervalChange: (interval: schemas['TimeInterval']) => void
  selectedSpanId?: string
  title?: string
}

export function SpansSidebar({
  organization,
  hierarchyStats,
  dateRange,
  interval,
  startDate,
  endDate,
  onDateRangeChange,
  onIntervalChange,
  selectedSpanId,
  title = 'Spans',
}: SpansSidebarProps) {
  const router = useRouter()
  const [hasScrolled, setHasScrolled] = useState(false)

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (event.currentTarget.scrollTop > 0 && !hasScrolled) {
        setHasScrolled(true)
      } else if (event.currentTarget.scrollTop === 0 && hasScrolled) {
        setHasScrolled(false)
      }
    },
    [hasScrolled],
  )

  return (
    <div className="flex h-full flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between gap-6 px-4 pt-4">
        <div>{title}</div>
      </div>
      <div
        className={twMerge(
          'flex flex-col gap-y-6 overflow-y-auto px-4 pt-2 pb-4',
          hasScrolled && 'dark:border-polar-700 border-t border-gray-200',
        )}
        onScroll={handleScroll}
      >
        <div className="flex h-full grow flex-col gap-y-6">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-sm">Timeline</h3>
            <DateRangePicker
              date={dateRange}
              onDateChange={onDateRangeChange}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <h3 className="text-sm">Interval</h3>
            <IntervalPicker
              interval={interval}
              onChange={onIntervalChange}
              startDate={startDate}
              endDate={endDate}
            />
          </div>
          <div className="dark:border-polar-700 -mx-4 border-t border-gray-200" />
          <div className="flex flex-col gap-y-2">
            <h3 className="text-sm">Events</h3>
            <List size="small" className="rounded-xl">
              {hierarchyStats?.totals?.map((stat) => (
                <ListItem
                  key={stat.name}
                  size="small"
                  className="justify-between px-3"
                  inactiveClassName="text-gray-500 dark:text-polar-500"
                  selected={selectedSpanId === stat.event_type_id}
                  onSelect={() => {
                    const params = getSearchParams(
                      { from: startDate, to: endDate },
                      interval,
                    )

                    if (selectedSpanId === stat.event_type_id) {
                      router.push(
                        `/dashboard/${organization.slug}/analytics/spans?${params}`,
                      )
                    } else {
                      router.push(
                        `/dashboard/${organization.slug}/analytics/spans/${stat.event_type_id}?${params}`,
                      )
                    }
                  }}
                >
                  <span className="truncate">{stat.label || stat.name}</span>
                  <span className="text-xxs dark:text-polar-500 font-mono text-gray-500">
                    {Number(stat.occurrences).toLocaleString('en-US', {
                      style: 'decimal',
                      compactDisplay: 'short',
                      notation: 'compact',
                    })}
                  </span>
                </ListItem>
              ))}
            </List>
          </div>
        </div>
      </div>
    </div>
  )
}
