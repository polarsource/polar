'use client'

import DateRangePicker from '@/components/Metrics/DateRangePicker'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useTaxJurisdictions } from '@/hooks/queries'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/orbit'
import Button from '@polar-sh/ui/components/atoms/Button'
import { endOfDay, endOfMonth, endOfToday, startOfMonth } from 'date-fns'
import { parseAsString, useQueryState } from 'nuqs'
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
      <Box display="flex" flexDirection="column" rowGap="xs">
        <Text>{original.state_name ?? original.country_name}</Text>
        <Text color="muted">
          {original.country_name} · {original.country}
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
      <Box textAlign="right">
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
    display="flex"
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

  const dateRange = useMemo(
    () => ({
      from: fromISODate(startDateISOString),
      to: endOfDay(fromISODate(endDateISOString)),
    }),
    [startDateISOString, endDateISOString],
  )

  const { data, isLoading } = useTaxJurisdictions({
    organization_id: organization.id,
    start_date: startDateISOString,
    end_date: endDateISOString,
    sorting: ['-tax_amount'],
    limit: 100,
  })

  const jurisdictions = useMemo(() => data?.items ?? [], [data])

  const summary = useMemo(() => {
    const totalRemitted = jurisdictions.reduce(
      (sum, j) => sum + j.tax_amount,
      0,
    )
    const totalOrders = jurisdictions.reduce((sum, j) => sum + j.order_count, 0)
    const currency = jurisdictions[0]?.currency ?? 'usd'
    return {
      totalRemitted,
      totalOrders,
      currency,
      jurisdictionCount: data?.pagination.total_count ?? jurisdictions.length,
    }
  }, [jurisdictions, data])

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-lg)!">
      <Box display="flex" flexDirection="column" rowGap="2xl">
        <Box
          display="flex"
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
          <Box display="flex" flexDirection="column" rowGap="xs">
            <Text variant="body" as="h2">
              Merchant of record
            </Text>
            <Text variant="body" color="muted">
              Polar collects and remits sales taxes for you automatically. No
              need for you to register or file in any jurisdictions.
            </Text>
          </Box>
          <Button variant="default" size="sm">
            Learn more
          </Button>
        </Box>
        <Box
          display="flex"
          flexDirection={{ base: 'column', md: 'row' }}
          gap="xl"
          flexWrap="wrap"
        >
          <SummaryCard
            label="Tax remitted by Polar"
            value={formatCurrency('accounting')(
              summary.totalRemitted,
              summary.currency,
            )}
            hint="Filed and paid for you"
          />
          <SummaryCard
            label="Jurisdictions covered"
            value={summary.jurisdictionCount.toLocaleString()}
            hint={`${summary.totalOrders.toLocaleString()} orders processed`}
          />
        </Box>

        <Box display="flex" flexDirection="column" rowGap="xl">
          <Box display="flex" flexDirection="column" rowGap="l">
            <Box display="flex" justifyContent="between" alignItems="center">
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
          />
        </Box>
      </Box>
    </DashboardBody>
  )
}
