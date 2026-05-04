'use client'

import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DataTable,
  DataTableColumnDef,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { formatCurrency } from '@polar-sh/currency'
import { twMerge } from 'tailwind-merge'
import { BillingOrder } from './mockData'

const formatPrice = formatCurrency('standard', 'en-US')

const STATUS_LABEL: Record<BillingOrder['status'], string> = {
  paid: 'Paid',
  pending: 'Pending',
  refunded: 'Refunded',
  void: 'Void',
}

const STATUS_COLOR: Record<BillingOrder['status'], string> = {
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  pending:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
  void: 'bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400',
}

export const BillingOrdersTable = ({ orders }: { orders: BillingOrder[] }) => {
  const columns: DataTableColumnDef<BillingOrder>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
      size: 110,
      cell: ({ row: { original } }) => (
        <FormattedDateTime datetime={original.date} />
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 200,
      cell: ({ row: { original } }) => (
        <Text as="span">{original.description}</Text>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      size: 90,
      cell: ({ row: { original } }) => (
        <Text as="span" className="font-medium">
          {formatPrice(original.amount, original.currency)}
        </Text>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 90,
      cell: ({ row: { original } }) => (
        <Status
          className={twMerge(STATUS_COLOR[original.status], 'w-fit')}
          status={STATUS_LABEL[original.status]}
        />
      ),
    },
    {
      id: 'actions',
      header: () => null,
      size: 56,
      cell: ({ row: { original } }) => (
        <Box display="flex" justifyContent="end">
          <a
            href={original.invoiceUrl}
            aria-label={`Download invoice ${original.number}`}
            className="dark:text-polar-400 dark:hover:bg-polar-700 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:text-white"
          >
            <FileDownloadOutlined fontSize="small" />
          </a>
        </Box>
      ),
    },
  ]

  if (orders.length === 0) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        rowGap="s"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor="background-card"
        paddingVertical="3xl"
      >
        <Text variant="subtle">No orders yet</Text>
      </Box>
    )
  }

  return <DataTable columns={columns} data={orders} isLoading={false} />
}
