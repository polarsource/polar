'use client'

import { BulkActionBar } from '@/components/BulkActions/BulkActionBar'
import CreateDiscountModalContent from '@/components/Discounts/CreateDiscountModalContent'
import UpdateDiscountModalContent from '@/components/Discounts/UpdateDiscountModalContent'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import {
  useDeleteDiscount,
  useDeleteDiscounts,
  useDiscounts,
} from '@/hooks/queries'
import { useSelection } from '@/hooks/useSelection'
import { useDebouncedCallback } from '@/hooks/utils'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { getDiscountDisplay } from '@/utils/discount'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import Search from '@mui/icons-material/Search'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Input } from '@polar-sh/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import React, { useCallback, useState } from 'react'

const getDiscountId = (discount: schemas['Discount']) => discount.id

interface ClientPageProps {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  query: string | undefined
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  query: _query,
}) => {
  const router = useRouter()
  const [query, setQuery] = useState(_query)

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    query: string | undefined,
  ) => {
    const params = serializeSearchParams(pagination, sorting)

    if (query) {
      params.append('query', query)
    }

    return params
  }

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
      `/dashboard/${organization.slug}/products/discounts?${getSearchParams(
        updatedPagination,
        sorting,
        query,
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
      `/dashboard/${organization.slug}/products/discounts?${getSearchParams(
        pagination,
        updatedSorting,
        query,
      )}`,
    )
  }

  const debouncedQueryChange = useDebouncedCallback((query: string) => {
    router.push(
      `/dashboard/${organization.slug}/products/discounts?${getSearchParams(
        { ...pagination, pageIndex: 0 },
        sorting,
        query,
      )}`,
    )
  }, 500)

  const discountsHook = useDiscounts(organization.id, {
    ...getAPIParams(pagination, sorting),
    query: _query,
  })

  const discounts = discountsHook.data?.items || []
  const rowCount = discountsHook.data?.pagination.total_count ?? 0
  const pageCount = discountsHook.data?.pagination.max_page ?? 1

  const selection = useSelection({
    items: discounts,
    getId: getDiscountId,
    resetKey: _query ?? '',
  })

  const onQueryChange = useCallback(
    (query: string) => {
      setQuery(query)
      debouncedQueryChange(query)
      selection.clear()
    },
    [debouncedQueryChange, selection],
  )

  const handleCopyDiscountId = useCallback(
    (discount: schemas['Discount']) => () => {
      if (typeof navigator !== 'undefined') {
        navigator.clipboard.writeText(discount.id)
      }
    },
    [],
  )

  const {
    isShown: isDiscountModalShown,
    hide: hideDiscountModal,
    toggle: toggleDiscountModal,
  } = useModal()

  const deleteDiscount = useDeleteDiscount()

  const [discountToDelete, setDiscountToDelete] =
    useState<schemas['Discount']>()

  const handleDeleteDiscount = useCallback(async () => {
    if (!discountToDelete) return

    const { error } = await deleteDiscount.mutateAsync(discountToDelete)
    if (error) {
      toast({
        title: 'Discount Deletion Failed',
        description: `Error deleting discount ${discountToDelete.name}: ${extractApiErrorMessage(error)}`,
      })
      return
    }
    toast({
      title: 'Discount Deleted',
      description: `Discount ${discountToDelete.name} successfully deleted`,
    })
    hideDiscountModal()
  }, [discountToDelete, deleteDiscount, hideDiscountModal])

  const deleteDiscounts = useDeleteDiscounts()

  const {
    isShown: isBulkDeleteModalShown,
    show: showBulkDeleteModal,
    hide: hideBulkDeleteModal,
  } = useModal()

  const handleBulkDeleteDiscounts = useCallback(async () => {
    const { succeeded, failed } = await deleteDiscounts.mutateAsync(
      selection.selected,
    )
    if (failed.length > 0) {
      toast({
        title: 'Some Discounts Were Not Deleted',
        description: `${String(succeeded.length)} deleted, ${String(failed.length)} failed`,
      })
    } else {
      toast({
        title: 'Discounts Deleted',
        description: `${String(succeeded.length)} discounts successfully deleted`,
      })
    }
    selection.clear()
  }, [deleteDiscounts, selection])

  const columns: DataTableColumnDef<schemas['Discount']>[] = [
    {
      accessorKey: 'name',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ getValue }) => {
        return <>{getValue()}</>
      },
    },
    {
      accessorKey: 'code',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ getValue }) => {
        const code = getValue() as string | null
        return code ? (
          <div className="flex flex-row items-center gap-1 font-mono">
            {code}
          </div>
        ) : (
          '—'
        )
      },
    },
    {
      accessorKey: 'amount',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original: discount } }) => {
        return <>{getDiscountDisplay(discount)}</>
      },
    },
    {
      accessorKey: 'redemptions_count',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Redemptions" />
      ),
      cell: ({ getValue, row: { original: discount } }) => {
        const redemptions = getValue() as number
        return (
          <>
            {redemptions}
            {discount.max_redemptions ? `/${discount.max_redemptions}` : ''}
          </>
        )
      },
    },
    {
      accessorKey: 'max_redemptions_per_customer',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Per Customer" />
      ),
      cell: ({ getValue }) => {
        const maxPerCustomer = getValue() as number | null
        return maxPerCustomer ?? '—'
      },
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row: { original: discount } }) => {
        return (
          <FormattedDateTime datetime={discount.created_at} resolution="day" />
        )
      },
    },
    {
      accessorKey: 'ends_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ends At" />
      ),
      cell: ({ row: { original: discount } }) => {
        return discount.ends_at ? (
          <FormattedDateTime datetime={discount.ends_at} resolution="day" />
        ) : (
          <span className="dark:text-polar-500 text-gray-500">Never</span>
        )
      },
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row: { original: discount } }) => (
        <div className="flex flex-row justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none" asChild>
              <Button
                className={
                  'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                }
                size="icon"
                variant="secondary"
              >
                <MoreVertOutlined fontSize="inherit" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="dark:bg-polar-800 bg-gray-50 shadow-lg"
            >
              <DropdownMenuItem onClick={() => onDiscountSelected(discount)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyDiscountId(discount)}>
                Copy Discount ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setDiscountToDelete(discount)
                  toggleDiscountModal()
                }}
                destructive
              >
                Delete Discount
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const [showNewModal, setShowNewModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedDiscount, setSelectedDiscount] =
    useState<schemas['Discount']>()

  const onDiscountSelected = (discount: schemas['Discount']) => {
    setSelectedDiscount(discount)
    setShowUpdateModal(true)
  }

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Input
              className="w-full md:max-w-64"
              preSlot={<Search fontSize="small" />}
              placeholder="Search Discounts"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            <BulkActionBar
              count={selection.count}
              pageState={selection.pageState}
              pageSelectedCount={selection.pageSelectedCount}
              pageSize={selection.pageSize}
              onPageSelectedChange={selection.setPageSelected}
              onClear={selection.clear}
            >
              <Button
                size="sm"
                variant="destructiveGhost"
                wrapperClassNames="flex flex-row items-center gap-x-1.5"
                onClick={showBulkDeleteModal}
              >
                <DeleteOutlined fontSize="inherit" />
                <span>Delete</span>
              </Button>
            </BulkActionBar>
          </div>
          <Button
            type="button"
            wrapperClassNames="flex flex-row items-center gap-x-2"
            onClick={() => setShowNewModal(true)}
          >
            <AddOutlined fontSize="small" />
            <span>New Discount</span>
          </Button>
        </div>
        {discounts && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={discounts}
            rowCount={rowCount}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={discountsHook.isLoading}
            selection={selection}
            getRowId={getDiscountId}
          />
        )}
      </div>
      <InlineModal
        isShown={showNewModal}
        hide={() => setShowNewModal(false)}
        modalContent={
          <CreateDiscountModalContent
            organization={organization}
            onDiscountCreated={() => setShowNewModal(false)}
            hideModal={() => setShowNewModal(false)}
          />
        }
      />
      <InlineModal
        isShown={showUpdateModal}
        hide={() => setShowUpdateModal(false)}
        modalContent={
          selectedDiscount ? (
            <UpdateDiscountModalContent
              organization={organization}
              discount={selectedDiscount}
              onDiscountUpdated={() => setShowUpdateModal(false)}
              hideModal={() => setShowUpdateModal(false)}
            />
          ) : null
        }
      />
      <ConfirmModal
        title="Delete Discount"
        description={`Are you sure you want to delete the discount "${discountToDelete?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteDiscount}
        isShown={isDiscountModalShown}
        hide={hideDiscountModal}
        destructiveText="Delete"
        destructive
      />
      <ConfirmModal
        title="Delete Discounts"
        description={`Are you sure you want to delete ${selection.count} ${
          selection.count === 1 ? 'discount' : 'discounts'
        }? This action cannot be undone.`}
        onConfirm={handleBulkDeleteDiscounts}
        isShown={isBulkDeleteModalShown}
        hide={hideBulkDeleteModal}
        destructiveText="Delete"
        destructive
      />
    </DashboardBody>
  )
}

export default ClientPage
