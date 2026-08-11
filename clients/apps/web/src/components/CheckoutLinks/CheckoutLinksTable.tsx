'use client'

import { CheckoutLinkManagementModal } from '@/components/CheckoutLinks/CheckoutLinkManagementModal'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useCheckoutLinksPage, useDeleteCheckoutLink } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { useDebouncedCallback } from '@/hooks/utils'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { getAPIParams } from '@/utils/datatable'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import { schemas } from '@polar-sh/client'
import { Alert, Button, DataTable, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryState,
  useQueryStates,
} from 'nuqs'
import { useCallback, useMemo, useState } from 'react'
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
  const [searchQuery, setSearchQuery] = useState(query ?? '')
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
  const checkoutLinksQuery = useCheckoutLinksPage(organization.id, {
    ...getAPIParams(pagination, sorting),
    product_id: productIds ?? undefined,
    query: query ?? undefined,
  })
  const checkoutLinks = checkoutLinksQuery.data?.items ?? []
  const rowCount = checkoutLinksQuery.data?.pagination.total_count ?? 0
  const pageCount = checkoutLinksQuery.data?.pagination.max_page ?? 1

  const debouncedQueryChange = useDebouncedCallback((value: string) => {
    void setFilters({ query: value || null })
    resetPage()
  }, 500)

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
    !checkoutLinksQuery.isLoading &&
    !checkoutLinksQuery.isError &&
    checkoutLinks.length === 0 &&
    !productIds?.length &&
    !query

  return (
    <Box flexDirection="column" rowGap="xl">
      <CheckoutLinksTableToolbar
        organization={organization}
        productIds={productIds ?? []}
        query={searchQuery}
        onQueryChange={(value) => {
          setSearchQuery(value)
          debouncedQueryChange(value)
        }}
        onProductIdsChange={(value) => {
          void setFilters({ productId: value.length > 0 ? value : null })
          resetPage()
        }}
        onCreate={showCreateModal}
      />

      {checkoutLinksQuery.isError ? (
        <Alert
          variant="danger"
          title="We couldn't load your checkout links"
          description="Something went wrong. Please try again."
          actions={[
            {
              text: 'Try again',
              onClick: () => void checkoutLinksQuery.refetch(),
            },
          ]}
        />
      ) : hasNoCheckoutLinks ? (
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
          data={checkoutLinks}
          rowCount={rowCount}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          isLoading={checkoutLinksQuery.isLoading}
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
