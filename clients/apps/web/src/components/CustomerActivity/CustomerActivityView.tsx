import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { useMemo } from 'react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useProducts } from '@/hooks/queries'
import { useInfiniteEvents } from '@/hooks/queries/events'
import { Timeline } from '../Timeline/Timeline'
import { EmptyState } from '../CustomerPortal/EmptyState'
import { CUSTOMER_ACTIVITY_TIMELINE } from './constants'
import {
  buildCustomerActivityTimeline,
  extractProductIdsFromEvents,
} from './timeline-utils'

const PAGE_SIZE = 100
const SORT_DIRECTIONS = ['desc', 'asc'] as const

type CustomerActivitySortDirection = (typeof SORT_DIRECTIONS)[number]

export const CustomerActivityView = ({
  customer,
  dateRange,
}: {
  customer: schemas['Customer']
  dateRange: { startDate: Date; endDate: Date }
}) => {
  const [sortDirection, setSortDirection] = useQueryState(
    'activity_sort',
    parseAsStringLiteral(SORT_DIRECTIONS).withDefault('desc'),
  )

  const {
    data: timelineResponse,
    status,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(customer.organization_id, {
    customer_id: customer.id,
    source: 'system',
    name: Array.from(CUSTOMER_ACTIVITY_TIMELINE.EVENT_NAMES),
    sorting: [sortDirection === 'asc' ? 'timestamp' : '-timestamp'],
    start_timestamp: dateRange.startDate.toISOString(),
    end_timestamp: dateRange.endDate.toISOString(),
    limit: PAGE_SIZE,
  })

  const timelineEvents = useMemo(
    () => timelineResponse?.pages.flatMap((page) => page.items) ?? [],
    [timelineResponse],
  )

  const productNamesById = useProductNamesById(
    customer.organization_id,
    timelineEvents,
  )

  const timelineSections = useMemo(() => {
    return buildCustomerActivityTimeline({
      sortedEvents: timelineEvents,
      productNamesById,
    })
  }, [timelineEvents, productNamesById])

  const hasTimelineActivity = timelineSections.length > 0

  const handleSortDirectionChange = (value: string) => {
    if (value === 'asc' || value === 'desc') {
      setSortDirection(value as CustomerActivitySortDirection)
    }
  }

  return (
    <TabsContent value="activity" className="flex flex-col gap-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg">Timeline</h3>
        <Tabs value={sortDirection} onValueChange={handleSortDirectionChange}>
          <TabsList>
            <TabsTrigger value="desc">Newest first</TabsTrigger>
            <TabsTrigger value="asc">Oldest first</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {status === 'error' ? (
        <EmptyState
          icon={<ErrorOutlineOutlined fontSize="medium" />}
          title="Could not load activity timeline"
          description="Please refresh the page and try again."
        />
      ) : null}
      {status === 'pending' ? (
        <div className="space-y-6">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] md:gap-8"
            >
              <div className="dark:bg-polar-700 h-5 w-40 animate-pulse rounded bg-gray-200" />
              <div className="dark:bg-polar-800 h-24 animate-pulse rounded-xl bg-gray-100" />
            </div>
          ))}
        </div>
      ) : null}
      {status === 'success' ? (
        <div className="space-y-8">
          {hasTimelineActivity ? (
            <Timeline sections={timelineSections} />
          ) : (
            <EmptyState
              icon={<HistoryOutlined fontSize="medium" />}
              title="No activity for this date range"
              description="Try widening the selected date range to see this customer's activity over time."
            />
          )}

          {hasNextPage ? (
            <Button
              variant="secondary"
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
            >
              Load More
            </Button>
          ) : null}
        </div>
      ) : null}
    </TabsContent>
  )
}

const useProductNamesById = (
  organizationId: string,
  events: schemas['Event'][],
): Record<string, string> => {
  const productIds = useMemo(
    () => extractProductIdsFromEvents(events),
    [events],
  )

  const { data: productsResponse } = useProducts(
    organizationId,
    {
      id: productIds,
      limit: PAGE_SIZE,
    },
    {
      enabled: productIds.length > 0,
    },
  )

  return useMemo(() => {
    const products = productsResponse?.items ?? []

    return Object.fromEntries(
      products.map((product) => [product.id, product.name]),
    )
  }, [productsResponse])
}
