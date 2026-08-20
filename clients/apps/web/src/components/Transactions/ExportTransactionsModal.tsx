'use client'

import DateRangePicker, {
  DateRange,
} from '@/components/Metrics/DateRangePicker'
import { getServerURL } from '@/utils/api'
import { schemas } from '@polar-sh/client'
import {
  Button,
  InlineModal,
  InlineModalHeader,
  List,
  ListItem,
  SegmentedControl,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { endOfToday, format, startOfDay } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import React, { useState } from 'react'
import ExportTransactionsColumns, {
  ALL_EXPORT_COLUMNS,
  DEFAULT_EXPORT_COLUMNS,
  ExportColumn,
  summarizeExportColumns,
  transactionExportColumns,
} from './ExportTransactionsColumns'

const formatExportRange = (range: DateRange): string => {
  const from = format(range.from, 'MMM d, yyyy')
  const to = format(range.to, 'MMM d, yyyy')
  return from === to ? from : `${from} – ${to}`
}

const formatGMTOffset = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en', { timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value ?? 'Local'

interface ExportTransactionsModalProps {
  organization: schemas['Organization']
  accountId?: string
  isShown: boolean
  hide: () => void
}

const ExportTransactionsModal: React.FC<ExportTransactionsModalProps> = ({
  organization,
  accountId,
  isShown,
  hide,
}) => {
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const localOffsetLabel = formatGMTOffset()
  const organizationStart = startOfDay(new Date(organization.created_at))
  const [timezone, setTimezone] = useState<'local' | 'utc'>('local')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: organizationStart,
    to: endOfToday(),
  })
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_EXPORT_COLUMNS)
  const [columnsExpanded, setColumnsExpanded] = useState(false)

  const rangeLabel = formatExportRange(dateRange)

  const onExport = () => {
    const url = new URL(
      getServerURL('/v1/transactions/export'),
      window.location.origin,
    )
    if (accountId) {
      url.searchParams.set('account_id', accountId)
    }
    url.searchParams.set('type', 'balance')
    url.searchParams.set('exclude_platform_fees', 'true')
    url.searchParams.set('created_after', dateRange.from.toISOString())
    url.searchParams.set('created_before', dateRange.to.toISOString())
    url.searchParams.set('timezone', timezone === 'utc' ? 'UTC' : localTimezone)

    for (const column of transactionExportColumns(columns)) {
      url.searchParams.append('columns', column)
    }

    window.open(url, '_blank')
    hide()
  }

  return (
    <InlineModal
      isShown={isShown}
      hide={hide}
      modalContent={
        <>
          <InlineModalHeader hide={hide}>
            <Text variant="heading-xs" as="h2">
              Export income
            </Text>
          </InlineModalHeader>

          <Box
            flexDirection="column"
            rowGap="xl"
            paddingHorizontal="2xl"
            paddingBottom="2xl"
          >
            <Text color="muted">Download your income as a CSV file.</Text>

            <List size="small">
              <ListItem
                size="small"
                className="px-4 py-3 hover:bg-transparent dark:hover:bg-transparent"
              >
                <Box flexDirection="column" rowGap="xs" minWidth={0}>
                  <Text>Time zone</Text>
                  <Text variant="caption" color="muted" truncate>
                    Dates in the file are written in this zone
                  </Text>
                </Box>
                <SegmentedControl
                  size="sm"
                  options={[
                    {
                      value: 'local',
                      label: localOffsetLabel,
                    },
                    { value: 'utc', label: 'UTC' },
                  ]}
                  value={timezone}
                  onChange={(value) => setTimezone(value as 'local' | 'utc')}
                />
              </ListItem>

              <ListItem
                size="small"
                className="px-4 py-3 hover:bg-transparent dark:hover:bg-transparent"
              >
                <Box flexDirection="column" rowGap="xs" minWidth={0}>
                  <Text>Date range</Text>
                  <Text variant="caption" color="muted" truncate>
                    {rangeLabel}
                  </Text>
                </Box>
                <Box flexShrink={0}>
                  <DateRangePicker
                    date={dateRange}
                    onDateChange={setDateRange}
                    minDate={organizationStart}
                  />
                </Box>
              </ListItem>

              <ListItem
                size="small"
                className="px-4 py-3 hover:bg-transparent dark:hover:bg-transparent"
              >
                <Box flexDirection="column" rowGap="xs" minWidth={0}>
                  <Text>Columns</Text>
                  <Text variant="caption" color="muted" truncate>
                    {summarizeExportColumns(columns)}
                  </Text>
                </Box>
                <Box flexShrink={0}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 px-4"
                    aria-expanded={columnsExpanded}
                    onClick={() => setColumnsExpanded((current) => !current)}
                  >
                    {columns.length === ALL_EXPORT_COLUMNS.length
                      ? `All ${ALL_EXPORT_COLUMNS.length}`
                      : `${columns.length} selected`}
                    <ChevronDown
                      className={`ml-2 h-4 w-4 opacity-50 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                        columnsExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </Button>
                </Box>
              </ListItem>

              {columnsExpanded ? (
                <Box
                  flexDirection="column"
                  paddingHorizontal="l"
                  paddingVertical="l"
                >
                  <ExportTransactionsColumns
                    selected={columns}
                    onChange={setColumns}
                  />
                </Box>
              ) : null}
            </List>

            <Box flexDirection="column" rowGap="s">
              <Button
                fullWidth
                disabled={columns.length === 0 || !accountId}
                onClick={onExport}
              >
                Export CSV
              </Button>
              <Text variant="caption" color="muted" align="center">
                {columns.length} columns | {rangeLabel}
              </Text>
            </Box>
          </Box>
        </>
      }
    />
  )
}

export default ExportTransactionsModal
