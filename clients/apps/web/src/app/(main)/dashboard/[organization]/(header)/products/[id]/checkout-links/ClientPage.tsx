'use client'

import { CheckoutLinkContextView } from '@/components/Checkout/CheckoutLinkContextView'
import { CheckoutLinkMangementModal } from '@/components/Checkout/CheckoutLinkMangementModal'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { useCheckoutLinks } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { AddOutlined } from '@mui/icons-material'
import { CheckoutLink, Organization, Product } from '@polar-sh/api'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { RowSelectionState } from '@tanstack/react-table'
import { usePathname, useRouter } from 'next/navigation'
import { parseAsJson, useQueryState } from 'nuqs'
import { useMemo } from 'react'

interface ClientPageProps {
  organization: Organization
  product: Product
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
}

export const ClientPage = ({
  product,
  pagination,
  sorting,
}: ClientPageProps) => {
  const [selectionState, setSelectionState] = useQueryState(
    'selectionState',
    parseAsJson((v) => v as RowSelectionState),
  )

  const {
    isShown: isManagementModalShown,
    hide: hideManagementModal,
    show: showManagementModal,
  } = useModal()

  const { data: checkoutLinks, isLoading } = useCheckoutLinks(
    product.organization_id,
    {
      productId: product.id,
      ...getAPIParams(pagination, sorting),
    },
  )

  const router = useRouter()
  const pathname = usePathname()

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
      `${pathname}?${serializeSearchParams(updatedPagination, sorting)}`,
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
      `${pathname}?${serializeSearchParams(pagination, updatedSorting)}`,
    )
  }

  const selectedLink = useMemo(() => {
    if (!checkoutLinks || !selectionState) {
      return undefined
    }

    const selectedLinkId = Object.keys(selectionState ?? {})[0]
    return checkoutLinks.items.find((link) => link.id === selectedLinkId)
  }, [checkoutLinks, selectionState])

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-y-2">
          <h1 className="text-2xl">Checkout Links</h1>
        </div>
      }
      header={
        <Button onClick={showManagementModal}>
          <AddOutlined className="mr-2" />
          New Link
        </Button>
      }
      className="flex flex-col gap-y-8"
      contextView={
        selectedLink ? (
          <CheckoutLinkContextView
            product={product}
            checkoutLink={selectedLink}
            onUpdate={(link) => {
              setSelectionState({ [link.id]: true })
            }}
          />
        ) : undefined
      }
    >
      <h2 className="text-lg">{product.name}</h2>
      <DataTable
        isLoading={isLoading}
        data={checkoutLinks?.items ?? []}
        pagination={pagination}
        onPaginationChange={setPagination}
        pageCount={checkoutLinks?.pagination.max_page ?? 1}
        sorting={sorting}
        onSortingChange={setSorting}
        columns={[
          {
            header: 'Label',
            accessorKey: 'label',
            cell: ({ cell }) =>
              cell.getValue() ? cell.getValue() : 'Unlabeled Link',
          },
          {
            header: 'Associated Price',
            accessorKey: 'product_price',
            cell: ({ cell }) => {
              const value = cell.row.original
              return value && value.product_price ? (
                <ProductPriceLabel price={value.product_price} />
              ) : (
                <Status
                  className="dark:bg-polar-800 dark:text-polar-500 w-fit bg-gray-300 text-black"
                  status="All"
                />
              )
            },
          },
        ]}
        enableRowSelection
        onRowSelectionChange={(updater) => {
          const newState =
            typeof updater === 'function'
              ? updater(selectionState ?? {})
              : updater
          setSelectionState(newState)
        }}
        rowSelection={selectionState ?? {}}
        getRowId={(row) => row.id}
      />
      <InlineModal
        isShown={isManagementModalShown}
        hide={hideManagementModal}
        modalContent={
          <CheckoutLinkMangementModal
            product={product}
            onClose={(checkoutLink: CheckoutLink) => {
              setSelectionState({ [checkoutLink.id]: true })
              hideManagementModal()
            }}
          />
        }
      />
    </DashboardBody>
  )
}
