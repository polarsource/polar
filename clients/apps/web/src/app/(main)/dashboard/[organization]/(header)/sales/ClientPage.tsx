'use client'

import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ProductSelect, {
  ProductSelectType,
} from '@/components/Products/ProductSelect'
import { useProductsByPriceType } from '@/hooks/products'
import { useCustomFields } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import {
  Order,
  OrderUser,
  Organization,
  Product,
  ProductPriceType,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import React, { useMemo } from 'react'

interface ClientPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string
  productPriceType?: ProductPriceType
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  productId,
  productPriceType,
}) => {
  const productsByPriceType = useProductsByPriceType(organization.id)

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    productId?: string,
    productPriceType?: ProductPriceType,
  ) => {
    const params = serializeSearchParams(pagination, sorting)

    if (productId) {
      params.append('product_id', productId)
    } else if (productPriceType) {
      params.append('product_price_type', productPriceType)
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
        productPriceType,
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
        productPriceType,
      )}`,
    )
  }

  const productSelectValue = useMemo(() => {
    if (productId) {
      return { productId }
    } else if (productPriceType) {
      return { productPriceType }
    }
    return undefined
  }, [productId, productPriceType])
  const onProductSelect = (value: ProductSelectType | undefined) => {
    router.push(
      `/dashboard/${organization.slug}/sales?${getSearchParams(
        pagination,
        sorting,
        value && 'productId' in value ? value.productId : undefined,
        value && 'productPriceType' in value
          ? value.productPriceType
          : undefined,
      )}`,
    )
  }

  const ordersHook = useOrders(organization.id, {
    ...getAPIParams(pagination, sorting),
    productId,
    productPriceType,
  })

  const orders = ordersHook.data?.items || []
  const pageCount = ordersHook.data?.pagination.max_page ?? 1

  const { data: customFields } = useCustomFields(organization.id)

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
            <Avatar avatar_url={user.avatar_url} name={user.public_name} />
            {user.github_username ? (
              <div className="fw-medium">@{user.github_username}</div>
            ) : null}
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
    ...(customFields
      ? customFields.items.map<DataTableColumnDef<Order>>((field) => ({
          accessorKey: `custom_field_data.${field.slug}`,
          enableSorting: false,
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={field.name} />
          ),
          cell: (props) => (
            <div className="max-w-48">
              <CustomFieldValue
                field={field}
                value={props.getValue() as string | number | boolean}
              />
            </div>
          ),
        }))
      : []),
  ]

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <div className="w-full max-w-[180px]">
            <ProductSelect
              productsByPriceType={productsByPriceType}
              value={productSelectValue}
              onChange={onProductSelect}
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
          />
        )}
      </div>
    </DashboardBody>
  )
}

export default ClientPage
