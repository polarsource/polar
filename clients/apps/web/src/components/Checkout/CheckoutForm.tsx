'use client'

import {
  Address,
  CheckoutConfirmStripe,
  CheckoutPublic,
  CheckoutUpdatePublic,
  SubscriptionRecurringInterval,
} from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import {
  AddressElement,
  Elements,
  ElementsConsumer,
  PaymentElement,
} from '@stripe/react-stripe-js'
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { PropsWithChildren, useCallback, useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import LogoType from '../Brand/LogoType'
import AmountLabel from '../Shared/AmountLabel'

const DetailRow = ({
  title,
  emphasis,
  children,
}: PropsWithChildren<{ title: string; emphasis?: boolean }>) => {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-between gap-x-8',
        emphasis ? 'font-medium' : 'dark:text-polar-500 text-gray-500',
      )}
    >
      <span>{title}</span>
      {children}
    </div>
  )
}

interface BaseCheckoutFormProps {
  onSubmit: (value: any) => Promise<void>
  onCheckoutUpdate?: (body: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  amount: number | null
  tax_amount: number | null
  currency: string | null
  interval?: SubscriptionRecurringInterval
  disabled?: boolean
  loading?: boolean
}

const BaseCheckoutForm = ({
  onSubmit,
  onCheckoutUpdate,
  amount,
  tax_amount,
  currency,
  interval,
  disabled,
  loading,
  children,
}: React.PropsWithChildren<BaseCheckoutFormProps>) => {
  const form = useFormContext<CheckoutUpdatePublic>()
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = form

  useEffect(() => {
    const subscription = watch(async (value, { name, type }) => {
      if (name === 'customer_tax_id' && type === 'change') {
        try {
          await onCheckoutUpdate?.({ customer_tax_id: value.customer_tax_id })
        } catch {}
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, onCheckoutUpdate])

  return (
    <div className="flex w-1/2 flex-col justify-between gap-y-24 p-20">
      <div className="flex flex-col gap-y-12">
        <h1 className="text-2xl">Checkout</h1>
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-y-12"
          >
            <div className="flex flex-col gap-y-6">
              <FormField
                control={control}
                name="customer_email"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {children}

              <FormField
                control={control}
                name="customer_tax_id"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Tax ID</FormLabel>
                      <span className="dark:text-polar-500 text-xs text-gray-500">
                        Optional
                      </span>
                    </div>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/*
              <FormField
                control={control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Discount Code</FormLabel>
                      <span className="dark:text-polar-500 text-xs text-gray-500">
                        Optional
                      </span>
                    </div>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
            </div>
            <div className="flex flex-col gap-y-2">
              {amount && currency ? (
                <>
                  <DetailRow title="Subtotal">
                    <AmountLabel
                      amount={amount}
                      currency={currency}
                      interval={interval}
                    />
                  </DetailRow>
                  <DetailRow title="VAT / Sales Tax">
                    {formatCurrencyAndAmount(tax_amount || 0, currency)}
                  </DetailRow>
                  {/* {discountCode && (
                <DetailRow title={`Discount Code (${discountCode})`}>
                  <span>$19</span>
                </DetailRow>
              )} */}
                  <DetailRow title="Total" emphasis>
                    <AmountLabel
                      amount={amount + (tax_amount || 0)}
                      currency={currency}
                      interval={interval}
                    />
                  </DetailRow>
                </>
              ) : (
                <span>Free</span>
              )}
            </div>
            <Button
              type="submit"
              size="lg"
              wrapperClassNames="text-base"
              disabled={disabled}
              loading={loading}
            >
              {interval ? 'Subscribe' : 'Pay'}
            </Button>
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
          </form>
        </Form>
        <p className="dark:text-polar-500 text-center text-xs text-gray-500">
          This order is processed by our online reseller & Merchant of Record,
          Polar, who also handles order-related inquiries and returns.
        </p>
      </div>
      <div className="dark:text-polar-600 flex w-full flex-row items-center justify-center gap-x-3 text-sm text-gray-400">
        <span>Powered by</span>
        <LogoType className="h-5" />
      </div>
    </div>
  )
}

interface CheckoutFormProps {
  checkout: CheckoutPublic
  onCheckoutUpdate?: (body: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  onCheckoutConfirm?: (body: CheckoutConfirmStripe) => Promise<CheckoutPublic>
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

const StripeCheckoutForm = (props: CheckoutFormProps) => {
  const router = useRouter()
  const { setError, setValue } = useFormContext<CheckoutUpdatePublic>()
  const { checkout, onCheckoutUpdate, onCheckoutConfirm } = props
  const { resolvedTheme } = useTheme()
  const [loading, setLoading] = useState(false)

  const onBillingAddressChange = useCallback(
    async (name: string, address: Address): Promise<void> => {
      try {
        await onCheckoutUpdate?.({
          customer_name: name,
          customer_billing_address: address,
          customer_tax_id:
            address.country !== checkout.customer_billing_address?.country
              ? null
              : undefined,
        })
        setValue('customer_tax_id', null)
      } catch {}
    },
    [onCheckoutUpdate, checkout],
  )
  const onSubmit = async (
    data: CheckoutUpdatePublic,
    stripe: Stripe | null,
    elements: StripeElements | null,
  ) => {
    if (!stripe || !elements || !onCheckoutConfirm) {
      return
    }

    setLoading(true)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      // Don't show validation errors, as they are already shown in their form
      if (submitError.type !== 'validation_error') {
        setError('root', { message: submitError.message })
      }
      setLoading(false)
      return
    }

    const { confirmationToken, error } = await stripe.createConfirmationToken({
      elements,
    })

    if (!confirmationToken || error) {
      setError('root', {
        message:
          error?.message ||
          'Failed to create confirmation token, please try again later.',
      })
      setLoading(false)
      return
    }

    let updatedCheckout: CheckoutPublic
    try {
      updatedCheckout = await onCheckoutConfirm({
        ...data,
        confirmation_token_id: confirmationToken.id,
      })
    } catch (e) {
      setLoading(false)
      return
    }

    const { payment_intent_status, payment_intent_client_secret } =
      updatedCheckout.payment_processor_metadata as Record<string, string>

    if (payment_intent_status === 'requires_action') {
      const { error } = await stripe.handleNextAction({
        clientSecret: payment_intent_client_secret,
      })
      if (error) {
        setLoading(false)
        setError('root', { message: error.message })
        return
      }
    }

    await router.push(`/checkout/${checkout.client_secret}/confirmation`)
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode:
          checkout.product_price.type === 'recurring'
            ? 'subscription'
            : 'payment',
        setupFutureUsage:
          checkout.product_price.type === 'recurring'
            ? 'off_session'
            : undefined,
        paymentMethodCreation: 'manual',
        amount: checkout.amount || 0,
        currency: checkout.currency || 'usd',
        appearance: {
          rules: {
            '.Label': {
              color: resolvedTheme === 'dark' ? 'white' : 'black',
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '8px',
            },
            '.Input': {
              padding: '12px',
              backgroundColor:
                resolvedTheme === 'dark' ? 'rgb(28 28 34)' : 'white',
              border: '0px',
              color: resolvedTheme === 'dark' ? '#E5E5E1' : '#181A1F',
              borderRadius: '9999px',
            },
            '.Input:focus': {
              borderColor: resolvedTheme === 'dark' ? '#4667CA' : '#A5C2EB',
            },
            '.Tab': {
              backgroundColor: 'transparent',
            },
          },
          variables: {
            borderRadius: '8px',
            fontFamily: '"Inter var", Inter, sans-serif',
            fontSizeBase: '0.875rem',
            spacingGridRow: '18px',
            colorDanger: resolvedTheme === 'dark' ? '#F17878' : '#E64D4D',
          },
        },
        fonts: [
          {
            cssSrc:
              'https://fonts.googleapis.com/css2?family=Inter:wght@400;500',
          },
        ],
      }}
    >
      <ElementsConsumer>
        {({ stripe, elements }) => (
          <BaseCheckoutForm
            {...props}
            amount={checkout.amount}
            tax_amount={checkout.tax_amount}
            currency={checkout.currency}
            interval={
              checkout.product_price.type === 'recurring'
                ? checkout.product_price.recurring_interval
                : undefined
            }
            onSubmit={(data) => onSubmit(data, stripe, elements)}
            onCheckoutUpdate={onCheckoutUpdate}
            loading={loading}
          >
            <AddressElement
              options={{ mode: 'billing' }}
              onChange={(event) =>
                onBillingAddressChange(event.value.name, event.value.address)
              }
            />
            <PaymentElement />
          </BaseCheckoutForm>
        )}
      </ElementsConsumer>
    </Elements>
  )
}

const DummyCheckoutForm = ({ checkout }: CheckoutFormProps) => {
  return (
    <BaseCheckoutForm
      amount={checkout.amount}
      tax_amount={checkout.tax_amount}
      currency={checkout.currency}
      onSubmit={async () => {}}
      onCheckoutUpdate={async () => checkout}
      disabled={true}
    />
  )
}

export const CheckoutForm = (props: CheckoutFormProps) => {
  const {
    checkout: { payment_processor },
  } = props

  if (payment_processor === 'stripe') {
    return <StripeCheckoutForm {...props} />
  }
  return <DummyCheckoutForm {...props} />
}
