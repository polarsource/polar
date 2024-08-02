'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import AddSubscriberModal from '@/components/Subscriptions/AddSubscriberModal'
import ImportSubscribersModal from '@/components/Subscriptions/ImportSubscribersModal'
import SubscriptionStatusSelect from '@/components/Subscriptions/SubscriptionStatusSelect'
import SubscriptionTiersSelect from '@/components/Subscriptions/SubscriptionTiersSelect'
import {
  getSubscriptionTiersByType,
  subscriptionStatusDisplayNames,
  tiersTypeDisplayNames,
} from '@/components/Subscriptions/utils'
import { useListSubscriptions, useProducts } from '@/hooks/queries'
import { getServerURL } from '@/utils/api'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import {
  Add,
  FileDownloadOutlined,
  FileUploadOutlined,
} from '@mui/icons-material'
import {
  Organization,
  Product,
  ProductPrice,
  Subscription,
  SubscriptionStatus,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import React, { useCallback, useMemo } from 'react'

interface ClientPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string
  subscriptionTierType?: SubscriptionTierType
  subscriptionStatus?: Extract<SubscriptionStatus, 'active' | 'canceled'>
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  productId,
  subscriptionTierType,
  subscriptionStatus,
}) => {
  const subscriptionTiers = useProducts(organization.id)
  const subscriptionTiersByType = useMemo(
    () => getSubscriptionTiersByType(subscriptionTiers.data?.items ?? []),
    [subscriptionTiers.data],
  )

  const filter = subscriptionTierType || productId || 'all'
  const status = subscriptionStatus || 'active'
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    filter: string,
    status: string,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (filter !== 'all') {
      if (Object.values(SubscriptionTierType).includes(filter as any)) {
        params.append('type', filter)
      } else {
        params.append('product_id', filter)
      }
    }

    params.append('status', status)

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
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        updatedPagination,
        sorting,
        filter,
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
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        pagination,
        updatedSorting,
        filter,
        status,
      )}`,
    )
  }

  const setFilter = (filter: string) => {
    router.push(
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        pagination,
        sorting,
        filter,
        status,
      )}`,
    )
  }

  const setStatus = (status: string) => {
    router.push(
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        pagination,
        sorting,
        filter,
        status,
      )}`,
    )
  }

  const subscriptionsHook = useListSubscriptions(organization.id, {
    ...getAPIParams(pagination, sorting),
    ...(productId ? { productId } : {}),
    ...(subscriptionTierType ? { type: subscriptionTierType } : {}),
    ...{ active: status === 'active' },
  })

  const subscriptions = subscriptionsHook.data?.items || []
  const pageCount = subscriptionsHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<Subscription>[] = [
    {
      id: 'user',
      accessorKey: 'user',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original: subscription } }) => {
        const user = subscription.user
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
      accessorKey: 'status',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ getValue, row: { original: subscription } }) => {
        return (
          <>
            {subscriptionStatusDisplayNames[getValue() as SubscriptionStatus]}
            {subscription.cancel_at_period_end &&
              subscription.current_period_end && (
                <span className="ml-2 shrink-0 rounded-lg border border-yellow-200 bg-yellow-100 px-1.5 text-xs text-yellow-600 dark:border-yellow-600 dark:bg-yellow-700 dark:text-yellow-300">
                  Cancels at{' '}
                  <FormattedDateTime
                    datetime={subscription.current_period_end}
                  />
                </span>
              )}
          </>
        )
      },
    },
    {
      accessorKey: 'started_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subscription date" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
    {
      accessorKey: 'current_period_end',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Renewal date" />
      ),
      cell: (props) => {
        const datetime = props.getValue() as string | null
        return datetime ? <FormattedDateTime datetime={datetime} /> : '—'
      },
    },
    {
      accessorKey: 'product.type',
      id: 'subscription_tier_type',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tier group" />
      ),
      cell: (props) =>
        tiersTypeDisplayNames[props.getValue() as SubscriptionTierType],
    },
    {
      accessorKey: 'product',
      id: 'product',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tier" />
      ),
      cell: (props) => {
        const tier = props.getValue() as Product
        return (
          <>
            {tier.name}
            {tier.is_archived && (
              <span className="ml-2 shrink-0 rounded-lg border border-yellow-200 bg-yellow-100 px-1.5 text-xs text-yellow-600 dark:border-yellow-600 dark:bg-yellow-700 dark:text-yellow-300">
                Archived
              </span>
            )}
          </>
        )
      },
    },
    {
      id: 'price_amount',
      accessorKey: 'price',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Price" />
      ),
      cell: (props) => {
        const price = props.getValue() as ProductPrice | null

        if (!price) {
          return '—'
        }

        return <ProductPriceLabel price={props.getValue() as ProductPrice} />
      },
    },
  ]

  const {
    isShown: importSubscribersIsShow,
    hide: hideImportSubscribers,
    show: showImportSubscribers,
  } = useModal()

  const {
    isShown: addSubscriberIsShown,
    hide: hideAddSubscriber,
    show: showAddSubscriber,
  } = useModal()
  const onHideAddSubscriber = useCallback(
    (added: boolean) => {
      if (added) {
        subscriptionsHook.refetch()
      }
      hideAddSubscriber()
    },
    [subscriptionsHook, hideAddSubscriber],
  )

  const onExport = () => {
    const url = new URL(
      `${getServerURL()}/v1/subscriptions/export?organization_id=${organization.id}`,
    )

    window.open(url, '_blank')
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <div className="w-full min-w-[180px]">
              <SubscriptionStatusSelect
                statuses={['active', 'canceled']}
                value={subscriptionStatus || 'active'}
                onChange={setStatus}
              />
            </div>
            <div className="w-full min-w-[180px]">
              <SubscriptionTiersSelect
                tiersByType={subscriptionTiersByType}
                value={subscriptionTierType || productId || 'all'}
                onChange={setFilter}
              />
            </div>
          </div>
        </div>
        {subscriptions && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={subscriptions}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={subscriptionsHook}
          />
        )}
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={showAddSubscriber}
            className="flex items-center"
            variant={'secondary'}
          >
            <Add className="mr-2" fontSize="small" />
            <span>Add</span>
          </Button>
          <Button
            onClick={showImportSubscribers}
            className="flex items-center"
            variant={'secondary'}
          >
            <FileUploadOutlined className="mr-2" fontSize="small" />
            <span>Import</span>
          </Button>

          <Button
            onClick={onExport}
            className="flex flex-row items-center "
            variant={'secondary'}
          >
            <FileDownloadOutlined className="mr-2" fontSize="small" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      <Modal
        isShown={addSubscriberIsShown}
        hide={hideAddSubscriber}
        modalContent={
          <AddSubscriberModal
            hide={onHideAddSubscriber}
            organization={organization}
          />
        }
      />

      <Modal
        isShown={importSubscribersIsShow}
        hide={hideImportSubscribers}
        modalContent={
          <ImportSubscribersModal
            hide={hideImportSubscribers}
            organization={organization}
          />
        }
      />
    </DashboardBody>
  )
}

export default ClientPage
