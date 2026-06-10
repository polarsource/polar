'use client'

import DateRangePicker from '@/components/Metrics/DateRangePicker'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useTaxJurisdictions, useTaxSummary } from '@/hooks/queries'
import { useDismissed } from '@/hooks/useDismissed'
import {
  DataTableSortingState,
  sortingQueryParamToState,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import { fromISODate, toISODate } from '@/utils/metrics'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
  Button,
} from '@polar-sh/orbit'
import { endOfDay, endOfMonth, endOfToday, startOfMonth } from 'date-fns'
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs'
import { useMemo } from 'react'

const getDefaultStartDate = () => toISODate(startOfMonth(endOfToday()))
const getDefaultEndDate = () => toISODate(endOfMonth(endOfToday()))

const columns: DataTableColumnDef<schemas['TaxJurisdiction']>[] = [
  {
    accessorKey: 'country',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Jurisdiction" />
    ),
    cell: ({ row: { original } }) => (
      <Box flexDirection="column" rowGap="xs">
        <Text>{original.state_name ?? original.country_name}</Text>
        <Text color="muted">
          {original.state_name
            ? `${original.country_name} · ${original.country}`
            : original.country}
        </Text>
      </Box>
    ),
  },
  {
    accessorKey: 'order_count',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Orders" />
    ),
    cell: ({ getValue }) => (
      <Text>{(getValue() as number).toLocaleString()}</Text>
    ),
    size: 100,
  },
  {
    id: 'status',
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: () => (
      <Status
        status="Handled"
        className="w-fit bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
      />
    ),
    size: 140,
  },
  {
    accessorKey: 'tax_amount',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Tax handled"
        className="flex justify-end"
      />
    ),
    cell: ({ row: { original } }) => (
      <Box display="block" textAlign="right">
        <Text>
          {formatCurrency('accounting')(original.tax_amount, original.currency)}
        </Text>
      </Box>
    ),
    size: 160,
  },
]

const SummaryCard = ({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) => (
  <Box
    flex={1}
    minWidth={200}
    borderRadius="l"
    backgroundColor="background-card"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    padding="xl"
    flexDirection="column"
    rowGap="l"
  >
    <Text variant="body">{label}</Text>
    <Text variant="heading-s" as="span">
      {value}
    </Text>
    {hint && (
      <Text variant="body" color="muted">
        {hint}
      </Text>
    )}
  </Box>
)

export default function TaxesPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [startDateISOString, setStartDateISOString] = useQueryState(
    'startDate',
    parseAsString.withDefault(getDefaultStartDate()),
  )
  const [endDateISOString, setEndDateISOString] = useQueryState(
    'endDate',
    parseAsString.withDefault(getDefaultEndDate()),
  )

  const [sortingParam, setSortingParam] = useQueryState(
    'sorting',
    parseAsArrayOf(parseAsString).withDefault(['-tax_amount']),
  )

  const dateRange = useMemo(
    () => ({
      from: fromISODate(startDateISOString),
      to: endOfDay(fromISODate(endDateISOString)),
    }),
    [startDateISOString, endDateISOString],
  )

  const sorting = useMemo(
    () => sortingQueryParamToState(sortingParam),
    [sortingParam],
  )

  const onSortingChange = (
    updater:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    setSortingParam(sortingStateToQueryParam(next))
  }

  const { data, isLoading } = useTaxJurisdictions({
    organization_id: organization.id,
    start_date: startDateISOString,
    end_date: endDateISOString,
    sorting: sortingParam as schemas['TaxJurisdictionSortProperty'][],
    limit: 100,
  })

  const { data: summary } = useTaxSummary({
    organization_id: organization.id,
    start_date: startDateISOString,
    end_date: endDateISOString,
  })

  const jurisdictions = useMemo(() => data?.items ?? [], [data])

  const { isDismissed: isMoRDismissed, dismiss: dismissMoR } = useDismissed(
    `mor_banner:${organization.id}`,
  )

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-lg)!">
      <Box flexDirection="column" rowGap="2xl">
        {!isMoRDismissed && (
          <Box
            position="relative"
            flexDirection="column"
            alignItems="start"
            columnGap="l"
            rowGap="l"
            borderRadius="l"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            padding="xl"
          >
            <Box flexDirection="column" rowGap="xs">
              <Text variant="body" as="h2">
                Merchant of Record
              </Text>
              <Text variant="body" color="muted">
                Polar collects and remits sales taxes for you automatically. No
                need for you to register or file in any jurisdictions.
              </Text>
            </Box>

            <Button variant="default" asChild>
              <a
                href="https://polar.sh/docs/merchant-of-record/introduction"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more
              </a>
            </Button>

            <button
              type="button"
              onClick={dismissMoR}
              aria-label="Dismiss"
              className="dark:text-polar-500 dark:hover:text-polar-300 absolute top-6 right-6 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
            >
              <CloseOutlined fontSize="small" />
            </button>
          </Box>
        )}
        <Box
          flexDirection={{ base: 'column', md: 'row' }}
          gap="xl"
          flexWrap="wrap"
        >
          <SummaryCard
            label="Tax remitted by Polar"
            value={formatCurrency('accounting')(
              summary?.tax_amount ?? 0,
              summary?.currency ?? 'usd',
            )}
            hint="Filed and paid for you"
          />
          <SummaryCard
            label="Jurisdictions covered"
            value={(summary?.jurisdiction_count ?? 0).toLocaleString()}
            hint={`${(summary?.order_count ?? 0).toLocaleString()} orders processed`}
          />
        </Box>

        <Box flexDirection="column" rowGap="xl">
          <Box flexDirection="column" rowGap="l">
            <Box justifyContent="between" alignItems="center">
              <Text variant="heading-xs" as="h2">
                Breakdown
              </Text>
              <DateRangePicker
                date={dateRange}
                onDateChange={(range) => {
                  setStartDateISOString(toISODate(range.from))
                  setEndDateISOString(toISODate(range.to))
                }}
              />
            </Box>
          </Box>
          <DataTable
            columns={columns}
            data={jurisdictions}
            isLoading={isLoading}
            sorting={sorting}
            onSortingChange={onSortingChange}
          />
        </Box>
      </Box>
    </DashboardBody>
  )
}
