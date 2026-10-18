'use client'

import { useEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import {
  DataTable,
  DataTablePaginationState,
  Status,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useState } from 'react'

const creditSource = ({ metadata }: schemas['MeterCreditEvent']) => {
  const manual = metadata.reason === 'manual'
  if (metadata.units < 0) {
    return { label: manual ? 'Reversed' : 'Revoked', color: 'red' } as const
  }
  return manual
    ? ({ label: 'Manual', color: 'purple' } as const)
    : ({ label: 'Benefit', color: 'blue' } as const)
}

export const CreditHistory = ({
  organization,
  customer,
  meter,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meter: schemas['Meter']
}) => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const { data, isLoading } = useEvents(organization.id, {
    name: 'meter.credited',
    customer_id: customer.id,
    metadata: { meter_id: meter.id },
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  })
  const pageInfo =
    data && 'max_page' in data.pagination ? data.pagination : null
  const credits = (data?.items ?? []).filter(
    (event): event is schemas['MeterCreditEvent'] =>
      event.name === 'meter.credited',
  )

  return (
    <Box flexDirection="column" rowGap="l">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xxs" as="h3">
          Credit history
        </Text>
        <Text color="muted">
          Credits granted by benefits and added manually
        </Text>
      </Box>
      <DataTable
        isLoading={isLoading}
        data={credits}
        pagination={pagination}
        onPaginationChange={setPagination}
        rowCount={pageInfo?.total_count ?? 0}
        pageCount={pageInfo?.max_page ?? 1}
        columns={[
          {
            id: 'timestamp',
            header: 'Date',
            cell: ({ row }) => (
              <FormattedDateTime
                datetime={row.original.timestamp}
                resolution="time"
              />
            ),
          },
          {
            id: 'source',
            header: 'Source',
            cell: ({ row }) => {
              const { label, color } = creditSource(row.original)
              return <Status status={label} color={color} size="small" />
            },
          },
          {
            id: 'rollover',
            header: 'At period end',
            cell: ({ row }) => (
              <Text color="muted">
                {row.original.metadata.rollover ? 'Carry over' : 'Expire'}
              </Text>
            ),
          },
          {
            id: 'units',
            header: () => <Box justifyContent="end">Credits</Box>,
            cell: ({ row }) => (
              <Box justifyContent="end">
                <Text tabularNums>
                  {row.original.metadata.units.toLocaleString('en-US', {
                    signDisplay: 'exceptZero',
                  })}
                </Text>
              </Box>
            ),
          },
        ]}
      />
    </Box>
  )
}
