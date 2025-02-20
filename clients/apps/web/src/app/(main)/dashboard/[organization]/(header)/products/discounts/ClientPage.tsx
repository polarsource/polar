'use client'

import CopyToClipboardButton from '@/components/CopyToClipboardButton/CopyToClipboardButton'
import CreateDiscountModalContent from '@/components/Discounts/CreateDiscountModalContent'
import UpdateDiscountModalContent from '@/components/Discounts/UpdateDiscountModalContent'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import { useDeleteDiscount, useDiscounts } from '@/hooks/queries'
import useDebouncedCallback from '@/hooks/utils'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { getDiscountDisplay } from '@/utils/discount'
import { AddOutlined, MoreVertOutlined, Search } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import React, { useCallback, useState } from 'react'

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

  const debouncedQueryChange = useDebouncedCallback(
    (query: string) => {
      router.push(
        `/dashboard/${organization.slug}/products/discounts?${getSearchParams(
          { ...pagination, pageIndex: 0 },
          sorting,
          query,
        )}`,
      )
    },
    500,
    [pagination, sorting, query, router],
  )

  const onQueryChange = useCallback(
    (query: string) => {
      setQuery(query)
      debouncedQueryChange(query)
    },
    [debouncedQueryChange],
  )

  const handleCopyDiscountId = useCallback(
    (discount: schemas['Discount']) => () => {
      if (typeof navigator !== 'undefined') {
        navigator.clipboard.writeText(discount.id)
      }
    },
    [],
  )

  const handleDeleteDiscount = useCallback(
    (discount: schemas['Discount']) => async () => {
      const { error } = await deleteDiscount.mutateAsync(discount)
      if (error) {
        return
      }
      toast({
        title: 'Discount Deleted',
        description: `Discount ${discount.name} successfully deleted`,
      })
    },
    [toast],
  )

  const discountsHook = useDiscounts(organization.id, {
    ...getAPIParams(pagination, sorting),
    query: _query,
  })

  const discounts = discountsHook.data?.items || []
  const pageCount = discountsHook.data?.pagination.max_page ?? 1

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
            <div>{code}</div>
            <div>
              <CopyToClipboardButton
                text={code}
                onCopy={() => {
                  toast({
                    title: 'Copied To Clipboard',
                    description: `Discount Code was copied to clipboard`,
                  })
                }}
              />
            </div>
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
              <DropdownMenuItem onClick={handleDeleteDiscount(discount)}>
                Delete
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
  const onDiscountSelected = useCallback((discount: schemas['Discount']) => {
    setSelectedDiscount(discount)
    setShowUpdateModal(true)
  }, [])
  const deleteDiscount = useDeleteDiscount()

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <div className="flex flex-row items-center justify-between gap-6">
          <Input
            className="w-full max-w-64"
            preSlot={<Search fontSize="small" />}
            placeholder="Search Discounts"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
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
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={discountsHook.isLoading}
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
          ) : (
            <></>
          )
        }
      />
    </DashboardBody>
  )
}

export default ClientPage
