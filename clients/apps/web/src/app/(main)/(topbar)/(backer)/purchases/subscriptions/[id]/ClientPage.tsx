'use client'

import BenefitDetails from '@/components/Benefit/BenefitDetails'
import { BenefitRow } from '@/components/Benefit/BenefitRow'
import { markdownOpts } from '@/components/Feed/Markdown/markdown'
import { InlineModal } from '@/components/Modal/InlineModal'
import { Modal, ModalProps } from '@/components/Modal'
import { setValidationErrors } from '@/utils/api/errors'
import AmountLabel from '@/components/Shared/AmountLabel'
import { Label } from 'polarkit/components/ui/label'
import ChangePlanModal from '@/components/Subscriptions/ChangePlanModal'
import {
  useCustomerCancelSubscription,
  useUserBenefits,
  useUserOrderInvoice,
  useUserOrders,
} from '@/hooks/queries'
import { ArrowBackOutlined, ReceiptOutlined } from '@mui/icons-material'
import {
  UserBenefit,
  UserOrder,
  UserSubscription,
  CustomerSubscriptionCancel,
  ResponseError,
  ValidationError,
  CustomerCancellationReason,
} from '@polar-sh/sdk'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useForm } from 'react-hook-form'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import { UseMutationResult } from '@tanstack/react-query'
import { RadioGroup, RadioGroupItem } from 'polarkit/components/ui/radio-group'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useCallback, useState } from 'react'
import { Point } from 'framer-motion'

const ClientPage = ({
  subscription: _subscription,
}: {
  subscription: UserSubscription
}) => {
  const [subscription, setSubscription] = useState(_subscription)
  const organization = subscription.product.organization
  const { data: benefits } = useUserBenefits({
    subscriptionId: subscription.id,
    limit: 100,
    sorting: ['type'],
  })

  const [selectedBenefit, setSelectedBenefit] = useState<UserBenefit | null>(
    null,
  )

  const { data: orders } = useUserOrders({
    subscriptionId: subscription.id,
    limit: 100,
    sorting: ['-created_at'],
  })

  const orderInvoiceMutation = useUserOrderInvoice()
  const openInvoice = useCallback(
    async (order: UserOrder) => {
      const { url } = await orderInvoiceMutation.mutateAsync(order.id)
      window.open(url, '_blank')
    },
    [orderInvoiceMutation],
  )

  const hasInvoices = orders?.items && orders.items.length > 0

  const [showChangePlanModal, setShowChangePlanModal] = useState(false)

  const cancelSubscription = useCustomerCancelSubscription(subscription.id)
  const isCanceled =
    cancelSubscription.isPending ||
    cancelSubscription.isSuccess ||
    subscription.ended_at ||
    subscription.cancel_at_period_end
  const [showCancelModal, setShowCancelModal] = useState(false)

  return (
    <div className="flex flex-col gap-y-8">
      <Link
        className="flex flex-row items-center gap-2 self-start text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
        href={`/purchases/subscriptions`}
      >
        <ArrowBackOutlined fontSize="inherit" />
        <span>Back to Purchases</span>
      </Link>
      <div className="flex h-full flex-grow flex-col-reverse gap-12 md:flex-row md:items-start">
        <div className="flex w-full flex-col gap-8 md:w-2/3">
          <ShadowBox className="flex flex-col gap-6 border-gray-200">
            {organization && (
              <Link
                className="flex flex-row items-center gap-x-4"
                href={`/${organization.slug}`}
              >
                <Avatar
                  className="h-12 w-12"
                  avatar_url={organization.avatar_url}
                  name={organization.name}
                />
                <h3 className="text-lg">{organization.name}</h3>
              </Link>
            )}
            <h1 className="text-3xl font-medium">
              {subscription.product.name}
            </h1>
            {subscription.product.description ? (
              <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md prose-h6:text-sm dark:prose-headings:text-polar-50 dark:text-polar-300 max-w-4xl text-gray-800">
                <Markdown
                  options={{
                    ...markdownOpts,
                    overrides: {
                      ...markdownOpts.overrides,
                      a: (props) => (
                        <a {...props} rel="noopener noreferrer nofollow" />
                      ),
                    },
                  }}
                >
                  {subscription.product.description}
                </Markdown>
              </div>
            ) : (
              <></>
            )}
          </ShadowBox>
          {(benefits?.items.length ?? 0) > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-medium">Benefits</h3>
              <List>
                {benefits?.items.map((benefit) => (
                  <ListItem
                    key={benefit.id}
                    selected={benefit.id === selectedBenefit?.id}
                    onSelect={() => setSelectedBenefit(benefit)}
                  >
                    <BenefitRow benefit={benefit} subscription={subscription} />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-8 md:max-w-[340px]">
          <ShadowBox className="flex flex-col gap-8 border-gray-200">
            <h3 className="text-lg font-medium">{subscription.product.name}</h3>
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-light">
                {subscription.amount && subscription.currency && (
                  <AmountLabel
                    amount={subscription.amount}
                    currency={subscription.currency}
                    interval={subscription.recurring_interval}
                  />
                )}
              </h1>
              {!isCanceled && subscription.started_at && (
                <p className="dark:text-polar-500 text-sm text-gray-400">
                  Subscribed since{' '}
                  {new Date(subscription.started_at).toLocaleDateString(
                    'en-US',
                    {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    },
                  )}
                </p>
              )}
              {isCanceled &&
                !subscription.ended_at &&
                subscription.cancel_at_period_end &&
                subscription.current_period_end && (
                  <p className="dark:text-polar-500 text-sm text-gray-400">
                    Will be canceled at{' '}
                    {new Date(
                      subscription.current_period_end,
                    ).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
              {isCanceled && subscription.ended_at && (
                <p className="dark:text-polar-500 text-sm text-gray-400">
                  Canceled since{' '}
                  {new Date(subscription.ended_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {!isCanceled && (
                <Button
                  size="lg"
                  fullWidth
                  onClick={() => setShowChangePlanModal(true)}
                >
                  Change Plan
                </Button>
              )}
              {!isCanceled && (
                <Button
                  size="lg"
                  variant="ghost"
                  className="dark:text-polar-500 text-gray-500"
                  fullWidth
                  onClick={() => setShowCancelModal(true)}
                >
                  Cancel Subscription
                </Button>
              )}
              <CustomerCancellationModal
                isShown={showCancelModal}
                hide={() => setShowCancelModal(false)}
                subscription={subscription}
                cancelSubscription={cancelSubscription}
              />
            </div>
          </ShadowBox>
          {hasInvoices && (
            <div className="flex flex-col gap-y-4">
              <h3 className="font-medium">Invoices</h3>
              <List size="small">
                {orders.items?.map((order) => (
                  <ListItem
                    key={order.id}
                    className="flex flex-row items-center justify-between"
                    size="small"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">
                        <FormattedDateTime
                          datetime={order.created_at}
                          dateStyle="medium"
                          resolution="day"
                        />
                      </span>
                      <span className="dark:text-polar-500 text-sm text-gray-500">
                        {formatCurrencyAndAmount(
                          order.amount,
                          order.currency,
                          0,
                        )}
                      </span>
                    </div>
                    <Button
                      className="h-8 w-8 rounded-full"
                      variant="secondary"
                      onClick={() => openInvoice(order)}
                      loading={orderInvoiceMutation.isPending}
                      disabled={orderInvoiceMutation.isPending}
                    >
                      <ReceiptOutlined fontSize="inherit" />
                    </Button>
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>
      </div>
      <InlineModal
        isShown={selectedBenefit !== null}
        hide={() => setSelectedBenefit(null)}
        modalContent={
          <div className="px-8 py-10">
            {selectedBenefit && (
              <BenefitDetails
                benefit={selectedBenefit}
                subscription={subscription}
              />
            )}
          </div>
        }
      />
      {organization && (
        <InlineModal
          isShown={showChangePlanModal}
          hide={() => setShowChangePlanModal(false)}
          modalContent={
            <ChangePlanModal
              organization={organization}
              subscription={subscription}
              hide={() => setShowChangePlanModal(false)}
              onUserSubscriptionUpdate={setSubscription}
            />
          }
        />
      )}
    </div>
  )
}

interface CustomerCancellationModalProps extends Omit<ModalProps, 'modalContent'> {
  subscription: UserSubscription,
  cancelSubscription: UseMutationResult<UserSubscription, Error, void, unknown>,
  onAbort?: () => void
}

const CustomerCancellationModal = ({
  subscription,
  cancelSubscription,
  onAbort,
  ...props
}: CustomerCancellationModalProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleCancel = useCallback(() => {
    onAbort?.()
    props.hide()
  }, [onAbort, props])

  const form = useForm<CustomerSubscriptionCancel>({
    defaultValues: {
      reason: null,
      comment: null,
    },
  })
  const { control, handleSubmit, watch, setError, setValue } = form

  const handleCancellation = useCallback(
    async (cancellation: CustomerSubscriptionCancel) => {
      try {
        setIsLoading(true)
        console.log('foobar', cancellation)
        await cancelSubscription.mutateAsync(cancellation)
        props.hide()
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(
              validationErrors,
              setError,
              1,
              Object.values(CustomerSubscriptionCancel),
            )
          } else {
            setError('root', { message: e.message })
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    [props.hide]
  )

  const onReasonSelect = (value: CustomerCancellationReason) => {
    setValue('reason', value ?? '')
  }

  return (
    <Modal
      {...props}
      className="md:min-w-[600px]"
      modalContent={
        <>
          <div className="flex flex-col gap-y-6 px-6 py-12">
            <>
              <h3 className="text-xl font-medium">We&apos;re sorry to see you go!</h3>
              <p className="dark:text-polar-400 max-w-full text-sm leading-relaxed text-gray-500">
                Please provide your feedback for leaving.
              </p>
              <Form {...form}>
                <form onSubmit={handleSubmit(handleCancellation)}>
                  <FormField
                    control={control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup value={field.value ?? 'other'} onValueChange={onReasonSelect}>
                            <CancellationReasonRadio value="unused" label="Not using it enough" />
                            <CancellationReasonRadio value="too_expensive" label="Too expensive" />
                            <CancellationReasonRadio value="missing_features" label="Missing features" />
                            <CancellationReasonRadio value="switched_service" label="Switched to another service" />
                            <CancellationReasonRadio value="customer_service" label="Customer service" />
                            <CancellationReasonRadio value="low_quality" label="Not satisfied with the quality" />
                            <CancellationReasonRadio value="too_complex" label="Too complicated" />
                            <CancellationReasonRadio value="other" label="Other (please share below)" />
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem className="mt-8">
                        <FormControl>
                          <TextArea value={field.value ?? ""} {...field} placeholder="Anything else you want to share? (Optional)" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-row gap-x-4 pt-6">
                    <Button
                      type="submit"
                      variant="destructive"
                    >
                      Cancel Subscription
                    </Button>
                    <Button variant="ghost" onClick={handleCancel}>
                      I don&apos;t want to cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          </div>
        </>
      }
    />
  )
}

const CancellationReasonRadio = ({
  value,
  label,
}: {
  value: CustomerCancellationReason
  label: string
}) => {
  return (
    <div className="flex flex-row">
      <RadioGroupItem value={value} id={`reason-${value}`} />
      <Label className="ml-4 grow" htmlFor={`reason-${value}`}>
        {label}
      </Label>
    </div>
  )
}

export default ClientPage
