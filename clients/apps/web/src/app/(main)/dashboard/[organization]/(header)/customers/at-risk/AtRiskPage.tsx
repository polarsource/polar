'use client'

import { CustomerCell } from '@/components/Customer/CustomerCell'
import { CustomersPageShell } from '@/components/Customer/CustomersPageShell'
import {
  AtRiskItem,
  cancelDate,
  useAtRisk,
} from '@/components/Customer/useAtRisk'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useClientSidePagination } from '@/hooks/useClientSidePagination'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Maximum accepted per status query (API_PAGINATION_MAX_LIMIT).
const LIMIT = 100

const columns: DataTableColumnDef<AtRiskItem>[] = [
  {
    id: 'customer',
    enableSorting: false,
    header: 'Customer',
    cell: ({ row: { original } }) => (
      <CustomerCell
        name={original.subscription.customer.name}
        email={original.subscription.customer.email}
        avatarUrl={original.subscription.customer.avatar_url}
      />
    ),
  },
  {
    id: 'product',
    enableSorting: false,
    header: 'Product',
    cell: ({ row: { original } }) => original.subscription.product.name,
  },
  {
    id: 'amount',
    enableSorting: false,
    header: 'Amount',
    cell: ({ row: { original } }) =>
      formatCurrency('statistics')(
        original.subscription.amount,
        original.subscription.currency,
      ),
  },
  {
    id: 'status',
    enableSorting: false,
    header: 'Status',
    cell: ({ row: { original } }) => (
      <Text color={original.reason === 'past_due' ? 'danger' : 'warning'}>
        {original.reason === 'past_due'
          ? 'Past due'
          : `Cancels ${cancelDate(original.subscription)}`}
      </Text>
    ),
  },
]

interface AtRiskPageProps {
  organization: schemas['Organization']
}

export const AtRiskPage = ({ organization }: AtRiskPageProps) => {
  const router = useRouter()
  const { items, isLoading, isError, refetch } = useAtRisk(organization, LIMIT)
  const { pageItems, pagination, setPagination, rowCount, pageCount } =
    useClientSidePagination(items)

  return (
    <CustomersPageShell organization={organization}>
      {isError ? (
        <Alert
          variant="danger"
          title="Could not load at-risk subscriptions"
          actions={[{ text: 'Retry', onClick: () => refetch() }]}
        />
      ) : !isLoading && items.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck />}
          title="Nothing at risk"
          description="No payment issues or scheduled cancellations."
        />
      ) : (
        <DataTable
          columns={columns}
          data={pageItems}
          isLoading={isLoading}
          rowCount={rowCount}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          getRowId={(item) => item.subscription.id}
          onRowClick={(row) =>
            router.push(
              `/dashboard/${organization.slug}/customers/${row.original.subscription.customer_id}`,
            )
          }
        />
      )}
    </CustomersPageShell>
  )
}
