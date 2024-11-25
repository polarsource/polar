'use client'

import { CheckoutCard } from '@/components/Checkout/CheckoutCard'
import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { createCheckoutPreview } from '@/components/Customization/utils'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import ProductSelect from '@/components/Products/ProductSelect'
import { useCustomFields, useProduct } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { Order, OrderUser, Organization, Product } from '@polar-sh/sdk'
import { RowSelectionState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import React, { useContext, useEffect, useState } from 'react'

interface ClientPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string[]
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  productId,
}) => {
  const [selectedOrderState, setSelectedOrderState] =
    useState<RowSelectionState>({})
  const { hide: hideModal, show: showModal, isShown: isModalShown } = useModal()

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    productId?: string[],
  ) => {
    const params = serializeSearchParams(pagination, sorting)

    if (productId) {
      productId.forEach((id) => params.append('product_id', id))
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
      `/dashboard/${organization.slug}/sales?${getSearchParams(
        updatedPagination,
        sorting,
        productId,
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
      `/dashboard/${organization.slug}/sales?${getSearchParams(
        pagination,
        updatedSorting,
        productId,
      )}`,
    )
  }

  const onProductSelect = (value: string[]) => {
    router.push(
      `/dashboard/${organization.slug}/sales?${getSearchParams(
        pagination,
        sorting,
        value,
      )}`,
    )
  }

  const ordersHook = useOrders(organization.id, {
    ...getAPIParams(pagination, sorting),
    productId,
  })

  const orders = ordersHook.data?.items || []
  const pageCount = ordersHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<Order>[] = [
    {
      accessorKey: 'user',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: (props) => {
        const user = props.getValue() as OrderUser
        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar
              className="h-8 w-8"
              avatar_url={user.avatar_url}
              name={user.public_name}
            />
            <div className="fw-medium">{user.email}</div>
          </div>
        )
      },
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
    {
      accessorKey: 'product',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Product" />
      ),
      cell: (props) => {
        const product = props.getValue() as Product
        return (
          <>
            {product.name}
            {product.is_archived && (
              <span className="ml-2 shrink-0 rounded-lg border border-yellow-200 bg-yellow-100 px-1.5 text-xs text-yellow-600 dark:border-yellow-600 dark:bg-yellow-700 dark:text-yellow-300">
                Archived
              </span>
            )}
          </>
        )
      },
    },
    {
      accessorKey: 'amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original: order } }) => (
        <>{formatCurrencyAndAmount(order.amount, order.currency)}</>
      ),
    },
  ]

  const selectedOrder = orders.find((order) => selectedOrderState[order.id])

  useEffect(() => {
    if (selectedOrder) {
      showModal()
    } else {
      hideModal()
    }
  }, [selectedOrder, showModal, hideModal])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <div className="w-auto">
            <ProductSelect
              organization={organization}
              value={productId || []}
              onChange={onProductSelect}
              className="w-[300px]"
            />
          </div>
        </div>
        {orders && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={orders}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={ordersHook.isLoading}
            onRowSelectionChange={(row) => {
              setSelectedOrderState(row)
            }}
            rowSelection={selectedOrderState}
            getRowId={(row) => row.id.toString()}
            enableRowSelection
          />
        )}
      </div>
      <InlineModal
        modalContent={<OrderModal order={selectedOrder} />}
        isShown={isModalShown}
        hide={() => {
          setSelectedOrderState({})
          hideModal()
        }}
      />
    </DashboardBody>
  )
}

interface OrderModalProps {
  order?: Order
}

const OrderModal = ({ order }: OrderModalProps) => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const { data: product } = useProduct(order?.product_id)
  const { data: customFields } = useCustomFields(organization.id)

  if (!order) return null

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="mb-4 text-2xl">Order Details</h2>
      <div className="flex flex-row items-center gap-4">
        <Avatar
          avatar_url={order.user.avatar_url}
          name={order.user.public_name}
          className="h-16 w-16"
        />
        <div className="flex flex-col gap-1">
          <p className="text-xl">{order.user.public_name}</p>
          <p className="dark:text-polar-500 text-gray-500">
            {order.user.email}
          </p>
        </div>
      </div>
      <h2 className="text-2xl">{order.product.name}</h2>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">Order Date</span>
          <span>
            <FormattedDateTime datetime={order.created_at} />
          </span>
        </div>
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">Tax</span>
          <span>
            {formatCurrencyAndAmount(order.tax_amount, order.currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">Discount</span>
          <span>{order.discount ? order.discount.code : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">Amount</span>
          <span>{formatCurrencyAndAmount(order.amount, order.currency)}</span>
        </div>
      </div>
      {(customFields?.items?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">Custom Fields</h3>
          <div className="flex flex-col gap-2">
            {customFields?.items?.map((field) => (
              <div
                key={field.slug}
                className="flex flex-row items-center justify-between"
              >
                <span className="dark:text-polar-500 text-gray-500">
                  {field.name}
                </span>
                <CustomFieldValue
                  field={field}
                  value={
                    order.custom_field_data
                      ? order.custom_field_data[
                          field.slug as keyof typeof order.custom_field_data
                        ]
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {product && (
        <CheckoutCard
          checkout={createCheckoutPreview(product, order.product_price)}
          disabled
        />
      )}
    </div>
  )
}

export default ClientPage
