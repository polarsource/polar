'use client'

import { useCustomFields } from '@/hooks/queries/customFields'
import { useCancelSubscription } from '@/hooks/queries/subscriptions'
import { setValidationErrors } from '@/utils/api/errors'
import { ArrowBackOutlined } from '@mui/icons-material'
import {
  Organization,
  ResponseError,
  Subscription,
  SubscriptionCancel,
  ValidationError,
} from '@polar-sh/api'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
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
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import CustomFieldValue from '../CustomFields/CustomFieldValue'
import AmountLabel from '../Shared/AmountLabel'
import { toast } from '../Toast/use-toast'
import { SubscriptionStatus } from './SubscriptionStatus'

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

const getHumanCancellationReason = (key: string | null) => {
  if (key && key in CANCELLATION_REASONS) {
    return CANCELLATION_REASONS[key]
  }
  return null
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
          <SubscriptionStatus subscription={subscription} />
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
              {subscription.ends_at ? 'Ending Date' : 'Renewal Date'}
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

interface SubscriptionModalProps {
  organization: Organization
  subscription?: Subscription
}

type SubscriptionModalViews = 'overview' | 'cancel'

export const SubscriptionModal = ({
  organization,
  subscription,
}: SubscriptionModalProps) => {
  const [view, setView] = useState<SubscriptionModalViews>('overview')

  if (!subscription) return null

  const isCancelled = subscription.status == 'canceled'
  const onCancelClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setView('cancel')
  }

  const showOverview = () => {
    setView('overview')
  }

  if (view == 'cancel') {
    return (
      <CancelSubscriptionView
        subscription={subscription}
        showOverview={showOverview}
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

interface CancelSubscriptionViewProps {
  subscription: Subscription
  showOverview: () => void
}

type CancellationAction = 'revoke' | 'cancel_at_period_end'

interface SubscriptionCancelForm extends SubscriptionCancel {
  cancellation_action: CancellationAction
}

const CancelSubscriptionView = ({
  subscription,
  showOverview,
}: CancelSubscriptionViewProps) => {
  const cancelSubscription = useCancelSubscription()
  const form = useForm<SubscriptionCancelForm>({
    defaultValues: {
      cancellation_action: 'cancel_at_period_end',
      customer_cancellation_reason: undefined,
    },
  })
  const { control, handleSubmit, setError, setValue } = form

  const onOverviewClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    showOverview()
  }

  const onSubmit = useCallback(
    async (cancellation: SubscriptionCancelForm) => {
      try {
        let body: SubscriptionCancel = {
          customer_cancellation_reason:
            cancellation.customer_cancellation_reason,
        }
        if (cancellation.cancellation_action === 'revoke') {
          body.revoke = true
        } else {
          body.cancel_at_period_end = true
        }

        await cancelSubscription
          .mutateAsync({
            id: subscription.id,
            body: body,
          })
          .then(() => {
            toast({
              title: 'Subscription Cancelled',
              description: `Subscription ${subscription.product.name} successfully cancelled`,
            })

            showOverview()
          })
          .catch((error) => {
            toast({
              title: 'Subscription Cancellation Failed',
              description: `Error cancelling subscription ${subscription.product.name}: ${error.message}`,
            })
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
    [cancelSubscription, subscription.id, setError, showOverview],
  )

  const reasons = Object.keys(CANCELLATION_REASONS)
  let periodEndOutput: string | undefined = undefined
  if (subscription.current_period_end) {
    periodEndOutput = new Date(
      subscription.current_period_end,
    ).toLocaleDateString('en-US', {
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
                                {'  '}
                                <span>({periodEndOutput})</span>
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
