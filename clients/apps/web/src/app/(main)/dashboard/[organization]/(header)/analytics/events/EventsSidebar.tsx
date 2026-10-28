'use client'

import { CustomerSelector } from '@/components/Customer/CustomerSelector'
import { EventMetadataFilter } from '@/components/Events/EventMetadataFilter'
import { EventTypeFilter } from '@/components/Events/EventTypeFilter'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import { useEventNames } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import {
  Button,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { RotateCcw } from '@polar-sh/orbit/icons'

type Metadata = Record<string, string | number | boolean>

export const EventsSidebar = ({
  organization,
  dateRange,
  onDateRangeChange,
  selectedEventTypes,
  onToggleEventType,
  selectedCustomerIds,
  onSelectCustomerIds,
  metadata,
  onMetadataChange,
  hasActiveFilters,
  onReset,
}: {
  organization: schemas['Organization']
  dateRange: { from: Date; to: Date }
  onDateRangeChange: (range: { from: Date; to: Date }) => void
  selectedEventTypes: string[]
  onToggleEventType: (name: string) => void
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
                className="h-6 w-6"
                onClick={onReset}
                aria-label="Reset filters"
              >
                <RotateCcw className="h-3.5 w-3.5" />
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
        <EventMetadataFilter
          metadata={metadataEntries}
          onChange={(entries) =>
            onMetadataChange(
              Object.fromEntries(
                entries.map((entry) => [entry.key, entry.value]),
              ),
            )
          }
        />
      </Box>
    </Box>
  )
}
