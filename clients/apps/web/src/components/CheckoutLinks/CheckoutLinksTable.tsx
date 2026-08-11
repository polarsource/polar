'use client'

import { CheckoutLinkManagementModal } from '@/components/CheckoutLinks/CheckoutLinkManagementModal'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useCheckoutLinks, useDeleteCheckoutLink } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { sortingStateToQueryParam } from '@/utils/datatable'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import { schemas } from '@polar-sh/client'
import { Button, DataTable, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryState,
  useQueryStates,
} from 'nuqs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getCheckoutLinkLabel,
  getCheckoutLinkTableColumns,
} from './CheckoutLinkTableColumns'
import { CheckoutLinksTableToolbar } from './CheckoutLinksTableToolbar'

const filterParsers = {
  productId: parseAsArrayOf(parseAsString),
  query: parseAsString,
}

interface CheckoutLinksTableProps {
  organization: schemas['Organization']
}

export const CheckoutLinksTable = ({
  organization,
}: CheckoutLinksTableProps) => {
  const { pagination, setPagination, sorting, setSorting, resetPage } =
    useDataTableQueryState({
      defaultSorting: [{ id: 'label', desc: false }],
      defaultPageSize: 50,
    })
  const [{ productId: productIds, query }, setFilters] =
    useQueryStates(filterParsers)
  const [shouldCreateCheckoutLink, setShouldCreateCheckoutLink] = useQueryState(
    'create_checkout_link',
    parseAsBoolean.withDefault(false),
  )
  const [selectedCheckoutLink, setSelectedCheckoutLink] =
    useState<schemas['CheckoutLink']>()
  const [checkoutLinkToDelete, setCheckoutLinkToDelete] =
    useState<schemas['CheckoutLink']>()

  const managementModal = useModal()
  const deleteModal = useModal()
  const { mutateAsync: deleteCheckoutLink } = useDeleteCheckoutLink()
  const checkoutLinksQuery = useCheckoutLinks(organization.id, {
    product_id: productIds ?? undefined,
    sorting: sortingStateToQueryParam(sorting),
    limit: 100,
  })

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
  } = checkoutLinksQuery

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) {
      void fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isError, isFetchingNextPage])

  const checkoutLinks = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const filteredCheckoutLinks = useMemo(() => {
    const normalizedQuery = query?.trim().toLocaleLowerCase() ?? ''
    const direction = sorting[0]?.desc ? -1 : 1

    return checkoutLinks
      .filter((checkoutLink) =>
        getCheckoutLinkLabel(checkoutLink)
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
      .toSorted((first, second) => {
        const labelComparison = getCheckoutLinkLabel(first).localeCompare(
          getCheckoutLinkLabel(second),
          undefined,
          { sensitivity: 'base' },
        )
        return (
          direction * (labelComparison || first.id.localeCompare(second.id))
        )
      })
  }, [checkoutLinks, query, sorting])

  const pageCount = Math.max(
    1,
    Math.ceil(filteredCheckoutLinks.length / pagination.pageSize),
  )
  const pageStart = pagination.pageIndex * pagination.pageSize
  const paginatedCheckoutLinks = filteredCheckoutLinks.slice(
    pageStart,
    pageStart + pagination.pageSize,
  )

  const hideManagementModal = useCallback(() => {
    managementModal.hide()
    void setShouldCreateCheckoutLink(null)
  }, [managementModal, setShouldCreateCheckoutLink])

  const showCreateModal = useCallback(() => {
    setSelectedCheckoutLink(undefined)
    managementModal.show()
  }, [managementModal])

  const showEditModal = useCallback(
    (checkoutLink: schemas['CheckoutLink']) => {
      setSelectedCheckoutLink(checkoutLink)
      managementModal.show()
    },
    [managementModal],
  )

  const showDeleteModal = useCallback(
    (checkoutLink: schemas['CheckoutLink']) => {
      setCheckoutLinkToDelete(checkoutLink)
      deleteModal.show()
    },
    [deleteModal],
  )

  const handleDelete = useCallback(async () => {
    if (!checkoutLinkToDelete) return
    const { error } = await deleteCheckoutLink(checkoutLinkToDelete)
    if (error) {
      toast({
        title: 'Checkout Link Deletion Failed',
        description: `Error deleting checkout link: ${extractApiErrorMessage(error)}`,
      })
      return
    }
    toast({
      title: 'Checkout Link Deleted',
      description: `${getCheckoutLinkLabel(checkoutLinkToDelete)} Checkout Link was deleted successfully`,
    })
    resetPage()
  }, [checkoutLinkToDelete, deleteCheckoutLink, resetPage])

  const columns = useMemo(
    () =>
      getCheckoutLinkTableColumns({
        onEdit: showEditModal,
        onDelete: showDeleteModal,
      }),
    [showDeleteModal, showEditModal],
  )

  const hasNoCheckoutLinks =
    !isLoading &&
    !hasNextPage &&
    checkoutLinks.length === 0 &&
    !productIds?.length

  return (
    <Box flexDirection="column" rowGap="xl">
      <CheckoutLinksTableToolbar
        organization={organization}
        productIds={productIds ?? []}
        query={query ?? ''}
        onQueryChange={(value) => {
          void setFilters({ query: value || null })
          resetPage()
        }}
        onProductIdsChange={(value) => {
          void setFilters({ productId: value.length > 0 ? value : null })
          resetPage()
        }}
        onCreate={showCreateModal}
      />

      {hasNoCheckoutLinks ? (
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          paddingVertical="5xl"
          rowGap="l"
          textAlign="center"
        >
          <LinkOutlined fontSize="large" />
          <Box flexDirection="column" rowGap="xs">
            <Text variant="heading-xs">No checkout links</Text>
            <Text color="muted">
              Create a checkout link to share with your customers.
            </Text>
          </Box>
          <Button variant="secondary" onClick={showCreateModal}>
            Create checkout link
          </Button>
        </Box>
      ) : (
        <DataTable
          columns={columns}
          data={paginatedCheckoutLinks}
          rowCount={filteredCheckoutLinks.length}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          isLoading={isLoading || Boolean(hasNextPage && !isError)}
        />
      )}

      <InlineModal
        isShown={managementModal.isShown || shouldCreateCheckoutLink}
        hide={hideManagementModal}
        modalContent={
          <CheckoutLinkManagementModal
            key={
              shouldCreateCheckoutLink
                ? 'create'
                : (selectedCheckoutLink?.id ?? 'create')
            }
            organization={organization}
            checkoutLink={
              shouldCreateCheckoutLink ? undefined : selectedCheckoutLink
            }
            productIds={productIds ?? []}
            hide={hideManagementModal}
            onClose={hideManagementModal}
          />
        }
      />
      <ConfirmModal
        title="Confirm Deletion of Checkout Link"
        description="It will cause 404 responses if the link is still in use anywhere."
        onConfirm={handleDelete}
        isShown={deleteModal.isShown}
        hide={deleteModal.hide}
        confirmPrompt={checkoutLinkToDelete?.label ?? ''}
        destructiveText="Delete"
        destructive
      />
    </Box>
  )
}
