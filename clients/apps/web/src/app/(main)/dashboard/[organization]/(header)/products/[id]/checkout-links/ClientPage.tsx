'use client'

import { CheckoutLinkContextView } from '@/components/Checkout/CheckoutLinkContextView'
import { CheckoutLinkMangementModal } from '@/components/Checkout/CheckoutLinkMangementModal'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { toast } from '@/components/Toast/use-toast'
import { useCheckoutLinks } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { AddOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { RowSelectionState } from '@tanstack/react-table'
import { usePathname, useRouter } from 'next/navigation'
import { parseAsJson, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface ClientPageProps {
  organization: schemas['Organization']
  product: schemas['Product']
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
            header: 'Default Price',
            accessorKey: 'product_price',
            cell: ({ cell }) => {
              const value = cell.row.original
              return value && value.product_price ? (
                <ProductPriceLabel price={value.product_price} />
              ) : (
                <ProductPriceLabel price={value.product.prices[0]} />
              )
            },
          },
          {
            header: 'Allow Discount Codes',
            accessorKey: 'allow_discount_codes',
            cell: ({ cell }) => {
              const value = cell.row.original
              return (
                <Status
                  className={twMerge(
                    'w-fit',
                    value && value.allow_discount_codes
                      ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950'
                      : 'bg-red-100 text-red-400 dark:bg-red-950',
                  )}
                  status={
                    value && value.allow_discount_codes ? 'Enabled' : 'Disabled'
                  }
                />
              )
            },
          },
          {
            header: 'Success URL',
            accessorKey: 'success_url',
            cell: ({ cell }) => {
              return cell.row.original.success_url ? (
                <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
                  {cell.row.original.success_url}
                </span>
              ) : (
                <Status
                  className="dark:bg-polar-700 dark:text-polar-500 w-fit bg-gray-300 text-gray-500"
                  status="None"
                />
              )
            },
          },
          {
            header: '',
            accessorKey: 'actions',
            cell: ({ cell }) => {
              return (
                <span className="flex flex-row items-center justify-end">
                  <Button
                    size="sm"
                    className="w-fit"
                    variant="default"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      navigator.clipboard.writeText(cell.row.original.url)

                      toast({
                        title: 'Copied To Clipboard',
                        description: `Checkout Link was copied to clipboard`,
                      })
                    }}
                  >
                    Copy Link
                  </Button>
                </span>
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
            onClose={(checkoutLink) => {
              setSelectionState({ [checkoutLink.id]: true })
              hideManagementModal()
            }}
          />
        }
      />
    </DashboardBody>
  )
}
