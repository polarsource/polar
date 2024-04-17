'use client'

import { useSearchWebhooksDeliveries } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import {
  KeyboardArrowDownOutlined,
  KeyboardArrowRightOutlined,
} from '@mui/icons-material'
import { Organization, WebhookDelivery } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface DeliveriesTableProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
}

type DeliveryRow = WebhookDelivery & {
  isSubRow?: boolean
}

const DeliveriesTable: React.FC<DeliveriesTableProps> = ({
  organization,
  pagination,
  sorting,
}) => {
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    return params
  }

  const router = useRouter()

  const setPagination = (
    updaterOrValue:
      | DataTablePaginationState
      | ((old: DataTablePaginationState) => DataTablePaginationState),
  ) => {
    const updatedPagination =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pagination)
        : updaterOrValue

    router.push(
      `/maintainer/${organization.name}/webhooks?${getSearchParams(
        updatedPagination,
        sorting,
      )}`,
    )
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const updatedSorting =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue

    router.push(
      `/maintainer/${organization.name}/webhooks?${getSearchParams(
        pagination,
        updatedSorting,
      )}`,
    )
  }

  const deliveriesHook = useSearchWebhooksDeliveries({
    webhookEndpointId: '3f4e8245-af94-4393-92f1-1726395499c1',
    ...getAPIParams(pagination, sorting),
  })

  const deliveries: DeliveryRow[] = deliveriesHook.data?.items || []
  const pageCount = deliveriesHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<DeliveryRow>[] = [
    {
      id: 'expand',
      enableSorting: false,
      cell: ({ row }) => {
        if (!row.getCanExpand()) return null

        return (
          <button
            {...{
              onClick: row.getToggleExpandedHandler(),
              style: { cursor: 'pointer' },
            }}
          >
            {row.getIsExpanded() ? (
              <KeyboardArrowDownOutlined />
            ) : (
              <KeyboardArrowRightOutlined />
            )}
          </button>
        )
      },
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: (props) => {
        const { row } = props
        const { original: delivery } = row

        if (delivery.isSubRow) {
          return null
        }

        return (
          <FormattedDateTime datetime={delivery.created_at} resolution="time" />
        )
      },
    },
    {
      id: 'http_code',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),

      cell: (props) => {
        const { row } = props
        const { original: delivery } = row

        if (delivery.isSubRow) {
          return null
        }

        const success =
          delivery.http_code &&
          delivery.http_code >= 200 &&
          delivery.http_code <= 299

        if (delivery.http_code) {
          return (
            <span
              className={twMerge(success ? 'text-green-500' : 'text-red-500')}
            >
              {delivery.http_code}
            </span>
          )
        }

        return <span>Failed</span>
      },
    },
    {
      accessorKey: 'webhook_event',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Data" />
      ),
      cell: (props) => {
        const { row } = props
        const { original: delivery } = row
        const payload = JSON.parse(delivery.webhook_event.payload)

        if (delivery.isSubRow) {
          return <pre>{JSON.stringify(payload, undefined, 2)}</pre>
        }

        return <pre>{payload['type']}</pre>
      },
    },
  ]

  return (
    <>
      {deliveries && pageCount !== undefined ? (
        <DataTable
          columns={columns}
          data={deliveries}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          getSubRows={(row) => {
            if (row.isSubRow) {
              return undefined
            }
            console.log('sub row', row)
            return [{ ...row, isSubRow: true }]
          }}
          isLoading={deliveriesHook}
        />
      ) : null}
    </>
  )
}

export default DeliveriesTable
