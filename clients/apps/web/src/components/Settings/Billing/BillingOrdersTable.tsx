'use client'

import { useGetOrganizationOrderInvoice } from '@/hooks/queries/billing'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DataTable,
  DataTableColumnDef,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { useCallback } from 'react'

const formatPrice = formatCurrency('standard', 'en-US')

type PillColor = React.ComponentProps<typeof Pill>['color']

const STATUS: Record<string, { label: string; color: PillColor }> = {
  paid: { label: 'Paid', color: 'green' },
  pending: { label: 'Pending', color: 'yellow' },
  refunded: { label: 'Refunded', color: 'purple' },
  partially_refunded: { label: 'Partially refunded', color: 'purple' },
}

const BILLING_REASON_LABEL: Record<string, string> = {
  purchase: 'Purchase',
  subscription_create: 'Subscription',
  subscription_cycle: 'Subscription renewal',
  subscription_update: 'Subscription change',
}

const formatDescription = (order: schemas['OrganizationOrder']): string => {
  const reason =
    BILLING_REASON_LABEL[order.billing_reason] ?? order.billing_reason
  return `${order.product_name} — ${reason}`
}

const DownloadInvoiceButton = ({
  organizationId,
  order,
}: {
  organizationId: string
  order: schemas['OrganizationOrder']
}) => {
  const getInvoice = useGetOrganizationOrderInvoice(organizationId)

  const onClick = useCallback(async () => {
    const result = await getInvoice.mutateAsync(order.id)
    const opened = window.open(result.url, '_blank', 'noopener,noreferrer')
    if (!opened) {
      window.location.href = result.url
    }
  }, [getInvoice, order.id])

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      loading={getInvoice.isPending}
      disabled={getInvoice.isPending}
      aria-label={`Download invoice ${order.invoice_number}`}
    >
      <FileDownloadOutlined fontSize="small" />
    </Button>
  )
}

export const BillingOrdersTable = ({
  organizationId,
  orders,
}: {
  organizationId: string
  orders: schemas['OrganizationOrder'][]
}) => {
  const columns: DataTableColumnDef<schemas['OrganizationOrder']>[] = [
    {
      accessorKey: 'created_at',
      header: 'Date',
      size: 110,
      cell: ({ row: { original } }) => (
        <FormattedDateTime datetime={original.created_at} />
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 240,
      cell: ({ row: { original } }) => (
        <Text as="span">{formatDescription(original)}</Text>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: 'Amount',
      size: 100,
      cell: ({ row: { original } }) => (
        <Text as="span" variant="label">
          {formatPrice(original.total_amount, original.currency)}
        </Text>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 130,
      cell: ({ row: { original } }) => {
        const entry = STATUS[original.status]
        return (
          <Pill color={entry?.color ?? 'gray'}>
            {entry?.label ?? original.status}
          </Pill>
        )
      },
    },
    {
      id: 'actions',
      header: () => null,
      size: 56,
      cell: ({ row: { original } }) =>
        original.is_invoice_generated ? (
          <Box display="flex" justifyContent="end">
            <DownloadInvoiceButton
              organizationId={organizationId}
              order={original}
            />
          </Box>
        ) : null,
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
        <Text color="muted">No orders yet</Text>
      </Box>
    )
  }

  return <DataTable columns={columns} data={orders} isLoading={false} />
}
