'use client'

import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import AmountLabel from '@/components/Shared/AmountLabel'
import SubscriptionStatusSelect from '@/components/Subscriptions/SubscriptionStatusSelect'
import SubscriptionTiersSelect from '@/components/Subscriptions/SubscriptionTiersSelect'
import { subscriptionStatusDisplayNames } from '@/components/Subscriptions/utils'
import {
  useCustomFields,
  useListSubscriptions,
  useProducts,
} from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { getServerURL } from '@/utils/api'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { FileDownloadOutlined } from '@mui/icons-material'
import {
  Organization,
  Product,
  Subscription,
  SubscriptionStatus,
} from '@polar-sh/sdk'
import { RowSelectionState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

const StatusWrapper = ({
  children,
  color,
}: PropsWithChildren<{ color: string }>) => {
  return (
    <div className={`flex flex-row items-center gap-x-2`}>
      <span className={twMerge('h-2 w-2 rounded-full border-2', color)} />
      <span className="capitalize">{children}</span>
    </div>
  )
}

const Status = ({
  status,
  cancelAtPeriodEnd,
}: {
  status: SubscriptionStatus
  cancelAtPeriodEnd: boolean
}) => {
  switch (status) {
    case 'active':
      return (
        <StatusWrapper
          color={cancelAtPeriodEnd ? 'border-yellow-500' : 'border-emerald-500'}
        >
          {cancelAtPeriodEnd ? 'Ending' : 'Active'}
        </StatusWrapper>
      )
    default:
      return (
        <StatusWrapper color="border-red-500">
          {subscriptionStatusDisplayNames[status]}
        </StatusWrapper>
      )
  }
}

interface ClientPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string
  subscriptionStatus?: Extract<SubscriptionStatus, 'active' | 'canceled'>
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  productId,
  subscriptionStatus,
}) => {
  const [selectedSubscriptionState, setSelectedSubscriptionState] =
    useState<RowSelectionState>({})
  const { show: showModal, hide: hideModal, isShown: isModalShown } = useModal()

  const subscriptionTiers = useProducts(organization.id, { isRecurring: true })

  const filter = productId || 'all'
  const status = subscriptionStatus || 'active'
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    filter: string,
    status: string,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (filter !== 'all') {
      params.append('product_id', filter)
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
    ...{ active: status === 'active' },
  })

  const subscriptions = subscriptionsHook.data?.items || []
  const pageCount = subscriptionsHook.data?.pagination.max_page ?? 1

  const selectedSubscription = subscriptions.find(
    (subscription) => selectedSubscriptionState[subscription.id],
  )

  useEffect(() => {
    if (selectedSubscription) {
      showModal()
    } else {
      hideModal()
    }
  }, [selectedSubscription, showModal, hideModal])

  const columns: DataTableColumnDef<Subscription>[] = [
    {
      id: 'customer',
      accessorKey: 'customer',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original: subscription } }) => {
        const customer = subscription.customer
        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar
              avatar_url={customer.avatar_url}
              name={customer.name || customer.email}
            />
            <div className="fw-medium">{customer.email}</div>
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
      cell: ({ row: { original: subscription } }) => {
        return (
          <Status
            status={subscription.status}
            cancelAtPeriodEnd={subscription.cancel_at_period_end}
          />
        )
      },
    },
    {
      accessorKey: 'started_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subscription Date" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
    {
      accessorKey: 'current_period_end',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Renewal Date" />
      ),
      cell: (props) => {
        const datetime = props.getValue() as string | null
        return datetime ? <FormattedDateTime datetime={datetime} /> : '—'
      },
    },
    {
      accessorKey: 'product',
      id: 'product',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Product" />
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
  ]

  const onExport = () => {
    const url = new URL(
      `${getServerURL()}/v1/subscriptions/export?organization_id=${organization.id}`,
    )

    window.open(url, '_blank')
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex w-full flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div className="w-auto">
              <SubscriptionStatusSelect
                statuses={['active', 'canceled']}
                value={subscriptionStatus || 'active'}
                onChange={setStatus}
              />
            </div>
            <div className="w-auto">
              <SubscriptionTiersSelect
                products={subscriptionTiers.data?.items || []}
                value={productId || 'all'}
                onChange={setFilter}
              />
            </div>
          </div>
          <Button
            onClick={onExport}
            className="flex flex-row items-center"
            variant={'secondary'}
            wrapperClassNames="gap-x-2"
          >
            <FileDownloadOutlined fontSize="inherit" />
            <span>Export</span>
          </Button>
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
            onRowSelectionChange={(row) => {
              setSelectedSubscriptionState(row)
            }}
            rowSelection={selectedSubscriptionState}
            getRowId={(row) => row.id.toString()}
            enableRowSelection
          />
        )}
      </div>
      <InlineModal
        modalContent={<SubscriptionModal subscription={selectedSubscription} />}
        isShown={isModalShown}
        hide={() => {
          setSelectedSubscriptionState({})
          hideModal()
        }}
      />
    </DashboardBody>
  )
}

interface SubscriptionModalProps {
  subscription?: Subscription
}

const SubscriptionModal = ({ subscription }: SubscriptionModalProps) => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const { data: customFields } = useCustomFields(organization.id)

  if (!subscription) return null

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="mb-4 text-2xl">Subscription Details</h2>
      <div className="flex flex-row items-center gap-4">
        <Avatar
          avatar_url={subscription.customer.avatar_url}
          name={subscription.customer.name || subscription.customer.email}
          className="h-16 w-16"
        />
        <div className="flex flex-col gap-1">
          <p className="text-xl">{subscription.user.public_name}</p>
          <p className="dark:text-polar-500 text-gray-500">
            {subscription.customer.email}
          </p>
        </div>
      </div>
      <h2 className="text-2xl">{subscription.product.name}</h2>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">Status</span>
          <Status
            status={subscription.status}
            cancelAtPeriodEnd={subscription.cancel_at_period_end}
          />
        </div>
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">
            Started Date
          </span>
          <span>
            <FormattedDateTime datetime={subscription.created_at} />
          </span>
        </div>
        {subscription.current_period_end && !subscription.ended_at && (
          <div className="flex justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              {subscription.cancel_at_period_end
                ? 'Ending Date'
                : 'Renewal Date'}
            </span>
            <span>
              <FormattedDateTime datetime={subscription.current_period_end} />
            </span>
          </div>
        )}
        {subscription.ended_at && (
          <div className="flex justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              Ended Date
            </span>
            <span>
              <FormattedDateTime datetime={subscription.ended_at} />
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">
            Recurring Interval
          </span>
          <span>
            {subscription.recurring_interval === 'month' ? 'Month' : 'Year'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">Discount</span>
          <span>
            {subscription.discount ? subscription.discount.code : '—'}
          </span>
        </div>
        {subscription.amount && subscription.currency && (
          <div className="flex justify-between">
            <span className="dark:text-polar-500 text-gray-500">Amount</span>
            <AmountLabel
              amount={subscription.amount}
              currency={subscription.currency}
              interval={subscription.recurring_interval}
            />
          </div>
        )}
      </div>
      {(customFields?.items?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">Custom Fields</h3>
          <div className="flex flex-col gap-2">
            {customFields?.items?.map((field) => (
              <div key={field.slug} className="flex flex-col gap-y-2">
                <span>{field.name}</span>
                <div className="font-mono text-sm">
                  <CustomFieldValue
                    field={field}
                    value={
                      subscription.custom_field_data
                        ? subscription.custom_field_data[
                            field.slug as keyof typeof subscription.custom_field_data
                          ]
                        : undefined
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ClientPage
