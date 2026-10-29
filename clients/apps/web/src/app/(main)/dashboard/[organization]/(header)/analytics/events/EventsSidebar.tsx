'use client'

import { CustomerSelector } from '@/components/Customer/CustomerSelector'
import { EventMetadataFields } from '@/components/Events/EventMetadataFields'
import { EventTypeFilter } from '@/components/Events/EventTypeFilter'
import DateRangePicker, {
  DateRangeInterval,
  DateRangeIntervalSlug,
} from '@/components/Metrics/DateRangePicker'
import { useEventNames } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { FunnelX } from '@polar-sh/orbit/icons'

type Metadata = Record<string, string | number | boolean>

type Sorting = '-timestamp' | 'timestamp'

export const EventsSidebar = ({
  organization,
  dateRange,
  rangeIntervals,
  selectedRange,
  onDateRangeChange,
  sorting,
  onSortingChange,
  selectedEventTypes,
  onToggleEventType,
  costOnly,
  onCostOnlyChange,
  source,
  onSourceChange,
  selectedCustomerIds,
  onSelectCustomerIds,
  metadata,
  onMetadataChange,
  hasActiveFilters,
  onReset,
}: {
  organization: schemas['Organization']
  dateRange: { from: Date; to: Date }
  rangeIntervals: DateRangeInterval[]
  selectedRange: DateRangeIntervalSlug | null
  onDateRangeChange: (
    range: { from: Date; to: Date },
    interval?: DateRangeInterval,
  ) => void
  sorting: Sorting
  onSortingChange: (sorting: Sorting) => void
  selectedEventTypes: string[]
  onToggleEventType: (name: string) => void
  costOnly: boolean
  onCostOnlyChange: (costOnly: boolean) => void
  source: schemas['EventSource'] | null
  onSourceChange: (source: schemas['EventSource'] | null) => void
  selectedCustomerIds: string[] | null
  onSelectCustomerIds: (ids: string[] | null) => void
  metadata: Metadata | null
  onMetadataChange: (metadata: Metadata) => void
  hasActiveFilters: boolean
  onReset: () => void
}) => {
  const { data } = useEventNames(organization.id, {
    sorting: ['name'],
    limit: 500,
    customer_id: selectedCustomerIds ?? undefined,
  })
  const eventTypes = data?.pages.flatMap((page) => page.items) ?? []
  const metadataEntries = Object.entries(metadata ?? {}).map(
    ([key, value]) => ({ key, value }),
  )

  return (
    <Box flexDirection="column" gap="l" height="100%">
      <Box
        alignItems="center"
        justifyContent="between"
        paddingHorizontal="l"
        paddingTop="l"
        minHeight={40}
      >
        <Text>Filters</Text>
        {hasActiveFilters && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 [&_svg]:size-3!"
                onClick={onReset}
                aria-label="Reset filters"
              >
                <FunnelX />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset filters</TooltipContent>
          </Tooltip>
        )}
      </Box>
      <Box
        flexDirection="column"
        gap="xl"
        overflowY="auto"
        paddingHorizontal="l"
        paddingTop="s"
        paddingBottom="l"
      >
        <Box flexDirection="column" gap="s">
          <h3 className="text-sm">Timeline</h3>
          <DateRangePicker
            date={dateRange}
            onDateChange={onDateRangeChange}
            additionalIntervals={rangeIntervals}
            selectedInterval={selectedRange}
            className="w-full"
          />
        </Box>
        <Box flexDirection="column" gap="s">
          <h3 className="text-sm">Events</h3>
          <EventTypeFilter
            eventTypes={eventTypes}
            selected={selectedEventTypes}
            onToggle={onToggleEventType}
          />
        </Box>
        <CustomerSelector
          organizationId={organization.id}
          selectedCustomerIds={selectedCustomerIds}
          onSelectCustomerIds={onSelectCustomerIds}
        />
        <Box flexDirection="column" gap="s">
          <h3 className="text-sm">Source</h3>
          <Select
            value={source ?? 'all'}
            onValueChange={(value) =>
              onSourceChange(
                value === 'all' ? null : (value as schemas['EventSource']),
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </Box>
        <Box flexDirection="column" gap="s">
          <h3 className="text-sm">Cost</h3>
          <Select
            value={costOnly ? 'withCost' : 'all'}
            onValueChange={(value) => onCostOnlyChange(value === 'withCost')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="withCost">Only with cost</SelectItem>
            </SelectContent>
          </Select>
        </Box>
        <EventMetadataFields
          metadata={metadataEntries}
          onChange={(entries) =>
            onMetadataChange(
              Object.fromEntries(
                entries.map((entry) => [entry.key, entry.value]),
              ),
            )
          }
        />
        <Box flexDirection="column" gap="s">
          <h3 className="text-sm">Sorting</h3>
          <Select
            value={sorting}
            onValueChange={(value) => onSortingChange(value as Sorting)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-timestamp">Newest</SelectItem>
              <SelectItem value="timestamp">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </Box>
      </Box>
    </Box>
  )
}
