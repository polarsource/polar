'use client'

import DateRangePicker, {
  DateRange,
} from '@/components/Metrics/DateRangePicker'
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
import React, { useMemo, useState } from 'react'
import { ExportColumnGroup, ExportColumns } from './ExportColumns'
import { ExportSelection, createExportColumnConfig } from './utils'

const formatExportRange = (range: DateRange): string => {
  const from = format(range.from, 'MMM d, yyyy')
  const to = format(range.to, 'MMM d, yyyy')
  return from === to ? from : `${from} – ${to}`
}

const formatGMTOffset = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en', { timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value ?? 'Local'

interface ExportModalProps<T extends string> {
  start: string | Date
  title: string
  description: string
  dateRangeLabel: string
  columns: readonly ExportColumnGroup<T>[]
  defaultColumns: T[]
  onExport: (selection: ExportSelection<T>) => void
  banner?: React.ReactNode
  exportDisabled?: boolean
  isShown: boolean
  hide: () => void
}

export function ExportModal<T extends string>({
  start,
  title,
  description,
  dateRangeLabel,
  columns: columnGroups,
  defaultColumns,
  onExport,
  banner,
  exportDisabled = false,
  isShown,
  hide,
}: ExportModalProps<T>) {
  const columnConfig = useMemo(
    () => createExportColumnConfig(columnGroups, defaultColumns),
    [columnGroups, defaultColumns],
  )
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const localOffsetLabel = formatGMTOffset()
  const rangeStart = startOfDay(new Date(start))
  const [timezone, setTimezone] = useState<'local' | 'utc'>('local')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: rangeStart,
    to: endOfToday(),
  })
  const [columns, setColumns] = useState<T[]>(columnConfig.defaults)
  const [columnsExpanded, setColumnsExpanded] = useState(false)

  const rangeLabel = formatExportRange(dateRange)

  const handleExport = () => {
    if (exportDisabled) {
      return
    }

    onExport({
      dateRange,
      timezone: timezone === 'utc' ? 'UTC' : localTimezone,
      columns: columnConfig.order(columns),
    })
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
              {title}
            </Text>
          </InlineModalHeader>

          <Box
            flexDirection="column"
            rowGap="xl"
            paddingHorizontal="2xl"
            paddingBottom="2xl"
          >
            <Text color="muted">{description}</Text>

            {banner}

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
                  <Text>{dateRangeLabel}</Text>
                  <Text variant="caption" color="muted" truncate>
                    {rangeLabel}
                  </Text>
                </Box>
                <Box flexShrink={0}>
                  <DateRangePicker
                    date={dateRange}
                    onDateChange={setDateRange}
                    minDate={rangeStart}
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
                    {columnConfig.summarize(columns)}
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
                    {columns.length === columnConfig.all.length
                      ? `All ${columnConfig.all.length}`
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
                  <ExportColumns
                    config={columnConfig}
                    selected={columns}
                    onChange={setColumns}
                  />
                </Box>
              ) : null}
            </List>

            <Box flexDirection="column" rowGap="s">
              <Button
                fullWidth
                disabled={exportDisabled || columns.length === 0}
                onClick={handleExport}
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
