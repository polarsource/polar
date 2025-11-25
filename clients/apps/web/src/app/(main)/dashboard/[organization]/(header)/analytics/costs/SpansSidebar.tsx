'use client'

import { EventCostCreationGuideModal } from '@/components/Events/EventCostCreationGuideModal'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { schemas } from '@polar-sh/client'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { Button } from '@polar-sh/ui/components/ui/button'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { getSearchParams } from './utils'

interface SpansSidebarProps {
  organization: schemas['Organization']
  eventTypes: schemas['EventTypeWithStats'][] | undefined
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
  eventTypes,
  dateRange,
  interval,
  startDate,
  endDate,
  onDateRangeChange,
  onIntervalChange,
  selectedSpanId,
  title = 'Costs',
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

  const {
    isShown: isEventCostCreationGuideShown,
    show: showEventCostCreationGuide,
    hide: hideEventCostCreationGuide,
  } = useModal()

  return (
    <div className="flex h-full flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between gap-6 px-4 pt-4">
        <div>{title}</div>
        <Button
          size="icon"
          className="h-6 w-6 rounded-full"
          onClick={showEventCostCreationGuide}
        >
          <AddOutlined fontSize="small" />
        </Button>
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
          <div className="flex flex-col gap-y-2">
            <h3 className="text-sm">Events</h3>
            <List size="small" className="rounded-xl">
              {eventTypes?.map((eventType) => (
                <ListItem
                  key={eventType.id}
                  size="small"
                  className="justify-between px-3 font-mono text-xs"
                  inactiveClassName="text-gray-500 dark:text-polar-500"
                  selected={selectedSpanId === eventType.id}
                  onSelect={() => {
                    const params = getSearchParams(
                      { from: startDate, to: endDate },
                      interval,
                    )

                    if (selectedSpanId === eventType.id) {
                      router.push(
                        `/dashboard/${organization.slug}/analytics/costs?${params}`,
                      )
                    } else {
                      router.push(
                        `/dashboard/${organization.slug}/analytics/costs/${eventType.id}?${params}`,
                      )
                    }
                  }}
                >
                  <span className="truncate">
                    {eventType.label || eventType.name}
                  </span>
                  <span className="text-xxs dark:text-polar-500 font-mono text-gray-500">
                    {Number(eventType.occurrences).toLocaleString('en-US', {
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
      <Modal
        title="Cost Ingestion"
        isShown={isEventCostCreationGuideShown}
        hide={hideEventCostCreationGuide}
        modalContent={
          <EventCostCreationGuideModal hide={hideEventCostCreationGuide} />
        }
      />
    </div>
  )
}
