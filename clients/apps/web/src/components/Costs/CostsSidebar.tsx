'use client'

import { CustomerSelector } from '@/components/Customer/CustomerSelector'
import DateRangePicker, {
  DateRangeInterval,
  DateRangeIntervalSlug,
} from '@/components/Metrics/DateRangePicker'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ExplorerModeSwitch } from '../Events/ExplorerModeSwitch'
import { COST_GROUP_BY, CostGroupBy, CostRange } from './costRanges'

export const CostsSidebar = ({
  organizationId,
  organizationSlug,
  dateRange,
  rangeIntervals,
  selectedRange,
  onDateRangeChange,
  groupBy,
  onGroupByChange,
  selectedCustomerIds,
  onSelectCustomerIds,
  hasActiveFilters,
  onReset,
}: {
  organizationId: string
  organizationSlug: string
  dateRange: CostRange
  rangeIntervals: DateRangeInterval[]
  selectedRange: DateRangeIntervalSlug | null
  onDateRangeChange: (
    range: { from: Date; to: Date },
    interval?: DateRangeInterval,
  ) => void
  groupBy: CostGroupBy
  onGroupByChange: (groupBy: CostGroupBy) => void
  selectedCustomerIds: string[] | null
  onSelectCustomerIds: (ids: string[] | null) => void
  hasActiveFilters: boolean
  onReset: () => void
}) => (
  <Box flexDirection="column" gap="l" height="100%">
    <Box paddingHorizontal="l" paddingTop="l">
      <ExplorerModeSwitch
        organizationSlug={organizationSlug}
        mode="costs"
        customerIds={selectedCustomerIds}
      />
    </Box>
    <Box
      flexDirection="column"
      gap="xl"
      flexGrow={1}
      minHeight={0}
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
        <h3 className="text-sm">Group by</h3>
        <Select
          value={groupBy}
          onValueChange={(value) => onGroupByChange(value as CostGroupBy)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COST_GROUP_BY.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Box>
      <CustomerSelector
        organizationId={organizationId}
        selectedCustomerIds={selectedCustomerIds}
        onSelectCustomerIds={onSelectCustomerIds}
      />
    </Box>
    {hasActiveFilters && (
      <Box flexDirection="column" paddingHorizontal="l" paddingBottom="l">
        <Button variant="secondary" fullWidth onClick={onReset}>
          Reset filters
        </Button>
      </Box>
    )}
  </Box>
)
