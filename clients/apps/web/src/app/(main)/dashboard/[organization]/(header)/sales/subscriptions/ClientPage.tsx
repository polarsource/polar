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
  useCancelSubscription,
  useCustomFields,
  useListSubscriptions,
  useProducts,
} from '@/hooks/queries'
import { getServerURL } from '@/utils/api'
import { setValidationErrors } from '@/utils/api/errors'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import {
  AccessTimeOutlined,
  ArrowBackOutlined,
  CancelOutlined,
  FileDownloadOutlined,
} from '@mui/icons-material'
import {
  Organization,
  Product,
  ResponseError,
  Subscription,
  SubscriptionCancel,
  SubscriptionStatus,
  ValidationError,
} from '@polar-sh/sdk'
import { RowSelectionState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { FormattedDateTime, Pill } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import React, { MouseEvent, useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

const CANCELLATION_REASONS: {
  [key: string]: string
} = {
  unused: 'Unused',
  too_expensive: 'Too Expensive',
  missing_features: 'Missing Features',
  switched_service: 'Switched Service',
  customer_service: 'Customer Service',
  low_quality: 'Low Quality',
  too_complex: 'Too Complicated',
  other: 'Other',
}

const getHumanCancellationReason = (
  key: string | null,
) => {
  if (key && (key in CANCELLATION_REASONS)) {
    return CANCELLATION_REASONS[key]
  }
  return null
}

const StatusLabel = ({
  color,
  dt,
  icon,
  children,
}: {
  color: string
  dt?: string | null
  icon?: React.ReactNode
  children: React.ReactNode
}) => {
  let prettyEventDate = null
  if (dt) {
    const event = new Date(dt)
    const now = new Date()
    if (event.getFullYear() != now.getFullYear()) {
      prettyEventDate = event.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } else {
      prettyEventDate = event.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
      })
    }
  }

  return (
    <div className={`flex flex-row items-center gap-x-2`}>
      <span className={twMerge('h-2 w-2 rounded-full border-2', color)} />
      <span className="capitalize">{children}</span>
      {prettyEventDate && (
        <Pill color="gray" className="flex flex-row">
          {icon}
          <span className="!ml-1">{prettyEventDate}</span>
        </Pill>
      )}
    </div>
  )
}

const Status = ({ subscription }: { subscription: Subscription }) => {
  switch (subscription.status) {
    case 'active':
      if (!subscription.ends_at) {
        return <StatusLabel color="border-emerald-500">Active</StatusLabel>
      }
      return (
        <StatusLabel
          color="border-yellow-500"
          dt={subscription.ends_at}
          icon={<AccessTimeOutlined fontSize="inherit" />}
        >
          Ending
        </StatusLabel>
      )
    case 'canceled':
      return (
        <StatusLabel
          color="border-red-500"
          dt={subscription.ended_at}
          icon={<CancelOutlined fontSize="inherit" />}
        >
          Canceled
        </StatusLabel>
      )
    default:
      return (
        <StatusLabel color="border-red-500">
          {subscriptionStatusDisplayNames[subscription.status]}
        </StatusLabel>
      )
  }
}

interface ClientPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string
  subscriptionStatus?:
    | Extract<SubscriptionStatus, 'active' | 'canceled'>
    | 'any'
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
    ...(status !== 'any'
      ? {
          active: status === 'active',
        }
      : {}),
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
        return <Status subscription={subscription} />
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
        return datetime &&
          props.row.original.status === 'active' &&
          !props.row.original.cancel_at_period_end ? (
          <FormattedDateTime datetime={datetime} />
        ) : (
          '—'
        )
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
                value={subscriptionStatus || 'any'}
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
        modalContent={
          <SubscriptionModal
            organization={organization}
            subscription={selectedSubscription}
          />
        }
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
  organization: Organization
  subscription?: Subscription
}

type SubscriptionModalViews = 'overview' | 'cancel'

const SubscriptionModal = ({
  organization,
  subscription,
}: SubscriptionModalProps) => {
  const [view, setView] = useState<SubscriptionModalViews>('overview')

  if (!subscription) return null

  const isCancelled = subscription.status == 'canceled'

  const viewClickHandler = (view: SubscriptionModalViews) => {
    return (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      e.preventDefault()
      setView(view)
    }
  }

  const onCancelClick = viewClickHandler('cancel')
  const onOverviewClick = viewClickHandler('overview')

  if (view == 'cancel') {
    return (
      <CancelSubscriptionView
        subscription={subscription}
        onOverviewClick={onOverviewClick}
      />
    )
  }

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="mb-4 text-2xl">Subscription Details</h2>
      <SubscriptionDetails
        organization={organization}
        subscription={subscription}
      />
      {!isCancelled && (
        <Button
          size="lg"
          onClick={onCancelClick}
          variant="secondary"
          tabIndex={-1}
        >
          Cancel Subscription
        </Button>
      )}
    </div>
  )
}

interface SubscriptionDetailsProps extends SubscriptionModalProps {
  subscription: Subscription
}

const SubscriptionDetails = ({
  organization,
  subscription,
}: SubscriptionDetailsProps) => {
  const { data: customFields } = useCustomFields(organization.id)

  const cancellationReason = subscription.customer_cancellation_reason
  const cancellationComment = subscription.customer_cancellation_comment

  let nextEventDatetime: string | undefined = undefined
  let cancellationDate: Date | undefined = undefined
  if (subscription.ended_at) {
    cancellationDate = new Date(subscription.ended_at)
  } else if (subscription.ends_at) {
    nextEventDatetime = subscription.ends_at
    cancellationDate = new Date(subscription.ends_at)
  } else if (subscription.current_period_end) {
    nextEventDatetime = subscription.current_period_end
  }

  return (
    <>
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
          <Status subscription={subscription} />
        </div>
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">
            Started Date
          </span>
          <span>
            <FormattedDateTime datetime={subscription.created_at} />
          </span>
        </div>
        {nextEventDatetime && (
          <div className="flex justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              {subscription.ends_at
                ? 'Ending Date'
                : 'Renewal Date'}
            </span>
            <span>
              <FormattedDateTime datetime={nextEventDatetime} />
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
      {cancellationDate && (
        <div className="flex flex-col gap-y-4">
          <h3 className="text-lg">Cancellation Details</h3>
          <div className="flex flex-col gap-y-2">
            <div className="flex justify-between">
              <span className="dark:text-polar-500 text-gray-500">Ends</span>
              <span>
                {cancellationDate.toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="dark:text-polar-500 text-gray-500">Reason</span>
              <span>
                {cancellationReason
                  ? getHumanCancellationReason(cancellationReason)
                  : '—'}
              </span>
            </div>
          </div>
          {cancellationComment && (
            <TextArea tabIndex={-1} readOnly resizable={false}>
              {cancellationComment}
            </TextArea>
          )}
        </div>
      )}
    </>
  )
}

interface CancelSubscriptionViewProps {
  subscription: Subscription
  onOverviewClick: (
    e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => void
}

type CancellationAction = 'revoke' | 'cancel_at_period_end'

interface SubscriptionCancelForm extends SubscriptionCancel {
  cancellation_action: CancellationAction
}

const CancelSubscriptionView = ({
  subscription,
  onOverviewClick,
}: CancelSubscriptionViewProps) => {
  const cancelSubscription = useCancelSubscription()
  const form = useForm<SubscriptionCancelForm>({
    defaultValues: {
      cancellation_action: 'cancel_at_period_end',
      customer_cancellation_reason: undefined,
    },
  })
  const { control, handleSubmit, setError, setValue } = form

  const onSubmit = useCallback(
    async (cancellation: SubscriptionCancelForm) => {
      try {
        let body: SubscriptionCancel = {
          customer_cancellation_reason: cancellation.customer_cancellation_reason
        }
        if (cancellation.cancellation_action === 'revoke') {
          body.revoke = true
        } else {
          body.cancel_at_period_end = true
        }

        await cancelSubscription.mutateAsync({
          id: subscription.id,
          body: body
        })
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          } else {
            setError('root', { message: e.message })
          }
        }
      }
    },
    [
      cancelSubscription,
      subscription.id,
      setError,
    ],
  )

  const reasons = Object.keys(CANCELLATION_REASONS)
  let periodEndOutput: string | undefined = undefined
  if (subscription.current_period_end) {
    periodEndOutput = new Date(subscription.current_period_end).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <Button variant="ghost" size="icon" onClick={onOverviewClick}>
          <ArrowBackOutlined fontSize="small" />
        </Button>
        <h2 className="text-xl">Cancel Subscription</h2>
      </div>
      <div className="flex h-full flex-col gap-4">
        <Form {...form}>
          <form
            className="flex flex-grow flex-col justify-between gap-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-y-6">
              <FormField
                control={control}
                name="cancellation_action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cancellation Date</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(value: CancellationAction) => {
                          setValue('cancellation_action', value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Cancellation Time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="revoke">Immediately</SelectItem>
                          <SelectItem value="cancel_at_period_end">
                            End of current period
                            {periodEndOutput && (
                              <>
                                {'  '}<span>({periodEndOutput})</span>
                              </>
                            )}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="customer_cancellation_reason"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-y-2">
                    <div className="flex flex-col gap-2">
                      <FormLabel>Customer Feedback</FormLabel>
                      <FormDescription>
                        Did the customer specify why they wanted to cancel?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={undefined}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer cancellation reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(reasons).map((reason) => (
                            <SelectItem key={reason} value={reason}>
                              {getHumanCancellationReason(reason)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" variant={'destructive'} size="lg">
              Cancel Subscription
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default ClientPage
