'use client'

import CheckoutStatus from '@/components/CheckoutStatus/CheckoutStatus'
import CheckoutStatusSelect from '@/components/CheckoutStatusSelect/CheckoutStatusSelect'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ProductSelect from '@/components/Products/ProductSelect'
import { useCheckouts } from '@/hooks/queries/checkouts'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useRouter } from 'next/navigation'
import React from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string[]
  customerId?: string
  status?: schemas['CheckoutStatus']
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  productId,
  customerId,
  status,
}) => {
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    productId?: string[],
    customerId?: string,
    status?: string,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (productId) {
      productId.forEach((id) => {
        params.append('product_id', id)
      })
    }
    if (customerId) {
      params.append('customer_id', customerId)
    }
    if (status) {
      params.append('status', status)
    }
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
      `/dashboard/${organization.slug}/sales/checkouts?${getSearchParams(
        updatedPagination,
        sorting,
        productId,
        customerId,
        status,
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
      `/dashboard/${organization.slug}/sales/checkouts?${getSearchParams(
        pagination,
        updatedSorting,
        productId,
        customerId,
        status,
      )}`,
    )
  }

  const setStatus = (status: string) => {
    router.push(
      `/dashboard/${organization.slug}/sales/checkouts?${getSearchParams(
        pagination,
        sorting,
        productId,
        customerId,
        status,
      )}`,
    )
  }

  const setProductId = (productId: string[]) => {
    router.push(
      `/dashboard/${organization.slug}/sales/checkouts?${getSearchParams(
        pagination,
        sorting,
        productId,
        customerId,
        status,
      )}`,
    )
  }

  const checkoutsHook = useCheckouts(organization.id, {
    ...getAPIParams(pagination, sorting),
    ...(productId ? { product_id: productId } : {}),
    ...(customerId ? { customer_id: customerId } : {}),
    ...(status ? { status } : {}),
  })

  const checkouts = checkoutsHook.data?.items || []
  const pageCount = checkoutsHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<schemas['Checkout']>[] = [
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: (props) => (
        <FormattedDateTime
          datetime={props.getValue() as string}
          resolution="time"
        />
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
        return (
          <div className="flex flex-row items-center gap-2">
            {customerEmail ? (
              <>
                <Avatar avatar_url={null} name={customerEmail} />
                <div className="fw-medium">{customerEmail}</div>
              </>
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
          <div className="flex items-center gap-4">
            <CheckoutStatusSelect value={status || ''} onChange={setStatus} />
            <ProductSelect
              organization={organization}
              includeArchived
              value={productId || []}
              onChange={setProductId}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          data={checkouts}
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
