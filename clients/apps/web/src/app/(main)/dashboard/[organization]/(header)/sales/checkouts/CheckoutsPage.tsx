'use client'

import CheckoutStatus from '@/components/CheckoutStatus/CheckoutStatus'
import CheckoutStatusSelect from '@/components/CheckoutStatusSelect/CheckoutStatusSelect'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ProductSelect from '@/components/Products/ProductSelect'
import { useCheckouts } from '@/hooks/queries/checkouts'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { useDebouncedCallback } from '@/hooks/utils'
import { getAPIParams } from '@/utils/datatable'
import { enums, schemas } from '@polar-sh/client'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Input, Text } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import React from 'react'

const filterParsers = {
  product_id: parseAsArrayOf(parseAsString),
  customer_id: parseAsString,
  status: parseAsStringLiteral(enums.checkoutStatusValues),
  query: parseAsString,
}

interface ClientPageProps {
  organization: schemas['Organization']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization }) => {
  const router = useRouter()

  const { pagination, setPagination, sorting, setSorting, resetPage } =
    useDataTableQueryState({
      defaultSorting: [{ id: 'created_at', desc: true }],
      defaultPageSize: 50,
    })

  const [
    { product_id: productId, customer_id: customerId, status, query },
    setFilters,
  ] = useQueryStates(filterParsers)

  const onProductSelect = (value: string[]) => {
    setFilters({ product_id: value.length > 0 ? value : null })
    resetPage()
  }

  const onStatusSelect = (value: schemas['CheckoutStatus'] | null) => {
    setFilters({ status: value })
    resetPage()
  }

  const onQueryChange = useDebouncedCallback((value: string) => {
    setFilters({ query: value || null })
    resetPage()
  }, 500)

  const checkoutsHook = useCheckouts(organization.id, {
    ...getAPIParams(pagination, sorting),
    product_id: productId ?? undefined,
    customer_id: customerId ?? undefined,
    status: status ?? undefined,
    query: query ?? undefined,
  })

  const checkouts = checkoutsHook.data?.items || []
  const rowCount = checkoutsHook.data?.pagination.total_count ?? 0
  const pageCount = checkoutsHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<schemas['Checkout']>[] = [
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: (props) => (
        <Text as="span" tabularNums>
          <FormattedDateTime
            datetime={props.getValue() as string}
            resolution="time"
          />
        </Text>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: checkout } }) => {
        return <CheckoutStatus checkout={checkout} />
      },
    },
    {
      id: 'customer',
      accessorKey: 'customer',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original: checkout } }) => {
        const customerEmail = checkout.customer_email
        const customerName = checkout.customer_name
        const customerBillingName = checkout.customer_billing_name
        const showBillingName =
          !!customerName &&
          !!customerBillingName &&
          customerName.toLocaleLowerCase() !==
            customerBillingName.toLocaleLowerCase()
        return (
          <div className="flex flex-row items-center gap-2 overflow-hidden">
            {customerEmail ? (
              <div className="overflow-hidden text-ellipsis">
                {customerName || customerEmail}
                {showBillingName && (
                  <span className="dark:text-polar-500 ml-2 text-gray-500">
                    {customerBillingName}
                  </span>
                )}
              </div>
            ) : (
              <>—</>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'products',
      id: 'products',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Product" />
      ),
      cell: ({
        row: {
          original: { products },
        },
      }) => {
        return <>{products.map(({ name }) => name).join(', ')}</>
      },
    },
  ]

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <div className="flex w-full flex-row items-center justify-between gap-2">
          <div className="grid w-full grid-cols-2 gap-4 sm:w-auto sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <Input
                type="text"
                placeholder="Filter by email"
                defaultValue={query ?? ''}
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </div>
            <CheckoutStatusSelect value={status} onChange={onStatusSelect} />
            <ProductSelect
              organization={organization}
              includeArchived
              value={productId || []}
              onChange={onProductSelect}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          data={checkouts}
          rowCount={rowCount}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          isLoading={checkoutsHook.isLoading}
          onRowClick={(row) => {
            const checkout = row.original
            router.push(
              `/dashboard/${organization.slug}/sales/checkouts/${checkout.id}`,
            )
          }}
        />
      </div>
    </DashboardBody>
  )
}

export default ClientPage
