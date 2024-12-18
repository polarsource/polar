'use client'

import { useCheckoutClientSSE } from '@/hooks/sse'
import { CONFIG } from '@/utils/config'
import { getDiscountDisplay } from '@/utils/discount'
import { CloseOutlined } from '@mui/icons-material'
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import {
  CheckoutConfirmStripe,
  CheckoutPublic,
  CheckoutPublicConfirmed,
  CheckoutStatus,
  CheckoutUpdatePublic,
} from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import {
  Elements,
  ElementsConsumer,
  PaymentElement,
} from '@stripe/react-stripe-js'
import {
  ConfirmationToken,
  loadStripe,
  Stripe,
  StripeElements,
  StripeElementsOptions,
  StripeError,
} from '@stripe/stripe-js'
import debounce from 'lodash.debounce'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import CountryPicker from 'polarkit/components/ui/atoms/countrypicker'
import CountryStatePicker from 'polarkit/components/ui/atoms/countrystatepicker'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useFormContext, WatchObserver } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import LogoType from '../Brand/LogoType'
import CustomFieldInput from '../CustomFields/CustomFieldInput'
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
  checkout: CheckoutPublic
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
}

const BaseCheckoutForm = ({
  onSubmit,
  onCheckoutUpdate,
  checkout,
  disabled,
  loading,
  loadingLabel,
  children,
}: React.PropsWithChildren<BaseCheckoutFormProps>) => {
  const interval =
    checkout.product_price.type === 'recurring'
      ? checkout.product_price.recurring_interval
      : undefined
  const form = useFormContext<CheckoutUpdatePublic>()
  const {
    control,
    handleSubmit,
    watch,
    clearErrors,
    resetField,
    setValue,
    formState: { errors },
  } = form
  const country = watch('customer_billing_address.country')
  const watcher: WatchObserver<CheckoutUpdatePublic> = useCallback(
    async (value, { name, type }) => {
      if (type !== 'change' || !name || !onCheckoutUpdate) {
        return
      }

      let payload: CheckoutUpdatePublic = {}
      // Update Tax ID
      if (name === 'customer_tax_id') {
        payload = {
          ...payload,
          customer_tax_id: value.customer_tax_id,
          // Make sure the address is up-to-date while updating the tax ID
          ...(value.customer_billing_address &&
          value.customer_billing_address.country
            ? {
                customer_billing_address: {
                  ...value.customer_billing_address,
                  country: value.customer_billing_address.country,
                },
              }
            : {}),
        }
        clearErrors('customer_tax_id')
        // Update country, make sure to reset other address fields
      } else if (name === 'customer_billing_address.country') {
        const { customer_billing_address } = value
        if (customer_billing_address && customer_billing_address.country) {
          payload = {
            ...payload,
            customer_billing_address: {
              country: customer_billing_address.country,
            },
          }
          resetField('customer_billing_address', {
            defaultValue: { country: customer_billing_address.country },
          })
        }
        // Update other address fields
      } else if (name.startsWith('customer_billing_address')) {
        const { customer_billing_address } = value
        if (customer_billing_address && customer_billing_address.country) {
          payload = {
            ...payload,
            customer_billing_address: {
              ...customer_billing_address,
              country: customer_billing_address.country,
            },
          }
          clearErrors('customer_billing_address')
        }
      }

      if (Object.keys(payload).length === 0) {
        return
      }

      try {
        await onCheckoutUpdate(payload)
      } catch {}
    },
    [clearErrors, resetField, onCheckoutUpdate],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedWatcher = useCallback(debounce(watcher, 500), [watcher])

  const discountCode = watch('discount_code')
  const addDiscountCode = useCallback(async () => {
    if (!onCheckoutUpdate || !discountCode) {
      return
    }
    clearErrors('discount_code')
    try {
      await onCheckoutUpdate({ discount_code: discountCode })
    } catch {}
  }, [onCheckoutUpdate, discountCode, clearErrors])
  const removeDiscountCode = useCallback(async () => {
    if (!onCheckoutUpdate) {
      return
    }
    clearErrors('discount_code')
    try {
      await onCheckoutUpdate({ discount_code: null })
      resetField('discount_code')
    } catch {}
  }, [onCheckoutUpdate, clearErrors, resetField])

  useEffect(() => {
    const subscription = watch(debouncedWatcher)
    return () => subscription.unsubscribe()
  }, [watch, debouncedWatcher])

  const taxId = watch('customer_tax_id')
  const [showTaxId, setShowTaxID] = useState(false)
  const clearTaxId = useCallback(() => {
    setValue('customer_tax_id', '')
    setShowTaxID(false)
  }, [setValue])
  useEffect(() => {
    if (taxId) {
      setShowTaxID(true)
    }
  }, [taxId])

  return (
    <div className="flex flex-col justify-between gap-y-24">
      <div className="flex flex-col gap-y-12">
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
                      <Input
                        type="email"
                        autoComplete="email"
                        className="bg-white shadow-sm"
                        {...field}
                        value={field.value || ''}
                        disabled={checkout.customer_id !== null}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {children}

              {checkout.is_payment_form_required && (
                <>
                  <FormField
                    control={control}
                    name="customer_name"
                    rules={{
                      required: 'This field is required',
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cardholder name</FormLabel>
                        <FormControl>
                          <Input
                            className="bg-white shadow-sm"
                            type="text"
                            autoComplete="name"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Billing address</FormLabel>
                    <FormControl>
                      <FormField
                        control={control}
                        name="customer_billing_address.country"
                        rules={{
                          required: 'This field is required',
                        }}
                        render={({ field }) => (
                          <>
                            <CountryPicker
                              autoComplete="billing country"
                              value={field.value || undefined}
                              onChange={field.onChange}
                            />
                            <FormMessage />
                          </>
                        )}
                      />
                    </FormControl>
                    {(country === 'US' || country === 'CA') && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customer_billing_address.state"
                          rules={{
                            required: 'This field is required',
                          }}
                          render={({ field }) => (
                            <>
                              <CountryStatePicker
                                autoComplete="billing address-level1"
                                country={country}
                                value={field.value || undefined}
                                onChange={field.onChange}
                              />
                              <FormMessage />
                            </>
                          )}
                        />
                      </FormControl>
                    )}
                    {country === 'US' && (
                      <>
                        <FormControl>
                          <FormField
                            control={control}
                            name="customer_billing_address.line1"
                            rules={{
                              required: 'This field is required',
                            }}
                            render={({ field }) => (
                              <>
                                <Input
                                  type="text"
                                  autoComplete="billing address-line1"
                                  placeholder="Line 1"
                                  className="bg-white shadow-sm"
                                  {...field}
                                  value={field.value || ''}
                                />
                                <FormMessage />
                              </>
                            )}
                          />
                        </FormControl>
                        <FormControl>
                          <FormField
                            control={control}
                            name="customer_billing_address.line2"
                            render={({ field }) => (
                              <>
                                <Input
                                  type="text"
                                  autoComplete="billing address-line2"
                                  placeholder="Line 2"
                                  className="bg-white shadow-sm"
                                  {...field}
                                  value={field.value || ''}
                                />
                                <FormMessage />
                              </>
                            )}
                          />
                        </FormControl>
                        <div className="grid grid-cols-2 gap-x-2">
                          <FormControl>
                            <FormField
                              control={control}
                              name="customer_billing_address.postal_code"
                              rules={{
                                required: 'This field is required',
                              }}
                              render={({ field }) => (
                                <>
                                  <Input
                                    type="text"
                                    autoComplete="billing postal-code"
                                    placeholder="Postal code"
                                    className="bg-white shadow-sm"
                                    {...field}
                                    value={field.value || ''}
                                  />
                                  <FormMessage />
                                </>
                              )}
                            />
                          </FormControl>
                          <FormControl>
                            <FormField
                              control={control}
                              name="customer_billing_address.city"
                              rules={{
                                required: 'This field is required',
                              }}
                              render={({ field }) => (
                                <>
                                  <Input
                                    type="text"
                                    autoComplete="billing address-level2"
                                    placeholder="City"
                                    className="bg-white shadow-sm"
                                    {...field}
                                    value={field.value || ''}
                                  />
                                  <FormMessage />
                                </>
                              )}
                            />
                          </FormControl>
                        </div>
                      </>
                    )}
                    {errors.customer_billing_address?.message && (
                      <p className="text-destructive-foreground text-sm">
                        {errors.customer_billing_address.message}
                      </p>
                    )}
                  </FormItem>

                  {!showTaxId && (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setShowTaxID(true)}
                      className="flex w-full justify-end text-xs hover:no-underline"
                    >
                      Add Tax ID
                    </Button>
                  )}

                  {showTaxId && (
                    <FormField
                      control={control}
                      name="customer_tax_id"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex flex-row items-center justify-between">
                            <FormLabel>Tax ID</FormLabel>
                          </div>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="text"
                                autoComplete="off"
                                className="bg-white shadow-sm"
                                {...field}
                                value={field.value || ''}
                              />
                              <div className="absolute inset-y-0 right-1 z-10 flex items-center">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => clearTaxId()}
                                >
                                  <CloseOutlined className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}
              {checkout.allow_discount_codes &&
                checkout.is_discount_applicable && (
                  <FormField
                    control={control}
                    name="discount_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <div className="flex flex-row items-center justify-between">
                            <div>Discount Code</div>
                            <span className="dark:text-polar-500 text-xs text-gray-500">
                              Optional
                            </span>
                          </div>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="text"
                              autoComplete="off"
                              className="bg-white shadow-sm"
                              {...field}
                              value={field.value || ''}
                            />
                            <div className="absolute inset-y-0 right-1 z-10 flex items-center">
                              {!checkout.discount && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={addDiscountCode}
                                >
                                  Apply
                                </Button>
                              )}
                              {checkout.discount && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={removeDiscountCode}
                                >
                                  <CloseOutlined className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              {checkout.attached_custom_fields.map(
                ({ custom_field, required }) => (
                  <FormField
                    key={custom_field.id}
                    control={control}
                    // @ts-ignore
                    name={`custom_field_data.${custom_field.slug}`}
                    render={({ field }) => (
                      <CustomFieldInput
                        customField={custom_field}
                        required={required}
                        // @ts-ignore
                        field={field}
                      />
                    )}
                  />
                ),
              )}
            </div>
            {!checkout.is_free_product_price && (
              <div className="flex flex-col gap-y-2">
                {checkout.amount !== null && checkout.currency ? (
                  <>
                    <DetailRow title="Subtotal">
                      <AmountLabel
                        amount={checkout.amount}
                        currency={checkout.currency}
                        interval={interval}
                      />
                    </DetailRow>
                    {checkout.discount && (
                      <DetailRow
                        title={`${checkout.discount.name} (${getDiscountDisplay(checkout.discount)})`}
                      >
                        {formatCurrencyAndAmount(
                          (checkout.subtotal_amount || 0) - checkout.amount,
                          checkout.currency,
                        )}
                      </DetailRow>
                    )}
                    {checkout.tax_amount !== null && (
                      <DetailRow title="VAT / Sales Tax">
                        {formatCurrencyAndAmount(
                          checkout.tax_amount,
                          checkout.currency,
                        )}
                      </DetailRow>
                    )}
                    <DetailRow title="Total" emphasis>
                      <AmountLabel
                        amount={checkout.total_amount || 0}
                        currency={checkout.currency}
                        interval={interval}
                      />
                    </DetailRow>
                  </>
                ) : (
                  <span>Free</span>
                )}
              </div>
            )}
            <div className="flex w-full flex-col items-center justify-center gap-y-2">
              <Button
                type="submit"
                size="lg"
                wrapperClassNames="text-base"
                className="w-full"
                disabled={disabled}
                loading={loading}
              >
                {!checkout.is_payment_form_required
                  ? 'Submit'
                  : interval
                    ? 'Subscribe'
                    : 'Pay'}
              </Button>
              {loading && loadingLabel && (
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  {loadingLabel}
                </p>
              )}
              {errors.root && (
                <p className="text-destructive-foreground text-sm">
                  {errors.root.message}
                </p>
              )}
            </div>
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
  onCheckoutConfirm?: (
    body: CheckoutConfirmStripe,
  ) => Promise<CheckoutPublicConfirmed>
  theme?: 'light' | 'dark'
  embed?: boolean
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

const StripeCheckoutForm = (props: CheckoutFormProps) => {
  const router = useRouter()
  const { setError } = useFormContext<CheckoutUpdatePublic>()
  const { checkout, onCheckoutUpdate, onCheckoutConfirm, theme, embed } = props
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState<string | undefined>(
    undefined,
  )

  const elementsOptions = useMemo<StripeElementsOptions>(() => {
    if (
      checkout.is_payment_setup_required &&
      checkout.is_payment_required &&
      checkout.total_amount
    ) {
      return {
        mode: 'subscription',
        setupFutureUsage: 'off_session',
        paymentMethodCreation: 'manual',
        amount: checkout.total_amount,
        currency: checkout.currency || 'usd',
      }
    } else if (checkout.is_payment_required && checkout.total_amount) {
      return {
        mode: 'payment',
        paymentMethodCreation: 'manual',
        amount: checkout.total_amount,
        currency: checkout.currency || 'usd',
      }
    }

    return {
      mode: 'setup',
      paymentMethodCreation: 'manual',
      setupFutureUsage: 'off_session',
      currency: checkout.currency || 'usd',
    }
  }, [checkout])

  const checkoutEvents = useCheckoutClientSSE(checkout.client_secret)

  const onSuccess = useCallback(
    async (url: string, customerSessionToken: string) => {
      const parsedURL = new URL(url)
      const isInternalURL = url.startsWith(CONFIG.FRONTEND_BASE_URL)

      if (isInternalURL) {
        if (embed) {
          parsedURL.searchParams.set('embed', 'true')
          if (theme) {
            parsedURL.searchParams.set('theme', theme)
          }
        }
      }

      parsedURL.searchParams.set('customer_session_token', customerSessionToken)

      // For external success URL, make sure the checkout is processed before redirecting
      // It ensures the user will have an up-to-date status when they are redirected,
      // especially if the external URL doesn't implement proper webhook handling
      if (!isInternalURL) {
        await new Promise<void>((resolve) => {
          let checkoutSuccessful = false
          let orderCreated = false
          let subscriptionCreated = checkout.product_price.type !== 'recurring'
          let webhookEventDelivered = false

          const checkResolution = () => {
            if (checkoutSuccessful && orderCreated && subscriptionCreated) {
              setLoadingLabel(
                `Waiting confirmation from ${checkout.organization.name} `,
              )
            }
            if (
              checkoutSuccessful &&
              orderCreated &&
              subscriptionCreated &&
              webhookEventDelivered
            ) {
              resolve()
            }
          }

          const checkoutUpdatedListener = (data: {
            status: CheckoutStatus
          }) => {
            if (data.status === CheckoutStatus.SUCCEEDED) {
              checkoutSuccessful = true
              setLoadingLabel('Payment successful! Processing order...')
              checkoutEvents.off('checkout.updated', checkoutUpdatedListener)
              checkResolution()
            }
          }
          checkoutEvents.on('checkout.updated', checkoutUpdatedListener)

          const orderCreatedListener = () => {
            orderCreated = true
            checkoutEvents.off('checkout.order_created', orderCreatedListener)
            checkResolution()
          }
          checkoutEvents.on('checkout.order_created', orderCreatedListener)

          const subscriptionCreatedListener = () => {
            subscriptionCreated = true
            checkoutEvents.off(
              'checkout.subscription_created',
              subscriptionCreatedListener,
            )
            checkResolution()
          }
          if (!subscriptionCreated) {
            checkoutEvents.on(
              'checkout.subscription_created',
              subscriptionCreatedListener,
            )
          }

          const webhookEventDeliveredListener = (data?: {
            status: CheckoutStatus
          }) => {
            if (!data || data.status === CheckoutStatus.SUCCEEDED) {
              webhookEventDelivered = true
              checkoutEvents.off(
                'checkout.webhook_event_delivered',
                webhookEventDeliveredListener,
              )
              checkResolution()
            }
          }
          checkoutEvents.on(
            'checkout.webhook_event_delivered',
            webhookEventDeliveredListener,
          )
          // Wait webhook event to be delivered for 30 seconds max
          setTimeout(
            () => webhookEventDeliveredListener(),
            CONFIG.CHECKOUT_EXTERNAL_WEBHOOKS_WAITING_LIMIT_MS,
          )
        })
      }

      if (checkout.embed_origin) {
        PolarEmbedCheckout.postMessage(
          {
            event: 'success',
            successURL: parsedURL.toString(),
            redirect: !isInternalURL,
          },
          checkout.embed_origin,
        )
      }

      if (isInternalURL || !embed) {
        router.push(parsedURL.toString())
      }
    },
    [router, embed, theme, checkout, checkoutEvents],
  )

  const onSubmit = async (
    data: CheckoutUpdatePublic,
    stripe: Stripe | null,
    elements: StripeElements | null,
  ) => {
    if (!onCheckoutConfirm) {
      return
    }

    setLoading(true)

    if (!checkout.is_payment_form_required) {
      let updatedCheckout: CheckoutPublicConfirmed
      setLoadingLabel('Processing order')
      try {
        updatedCheckout = await onCheckoutConfirm(data)
      } catch (e) {
        setLoading(false)
        return
      }
      await onSuccess(
        updatedCheckout.success_url,
        updatedCheckout.customer_session_token,
      )
      return
    }

    if (!stripe || !elements) {
      setLoading(false)
      return
    }

    setLoadingLabel('Processing payment')

    const { error: submitError } = await elements.submit()
    if (submitError) {
      // Don't show validation errors, as they are already shown in their form
      if (submitError.type !== 'validation_error') {
        setError('root', { message: submitError.message })
      }
      setLoading(false)
      return
    }

    let confirmationToken: ConfirmationToken | undefined
    let error: StripeError | undefined
    try {
      const confirmationTokenResponse = await stripe.createConfirmationToken({
        elements,
        params: {
          payment_method_data: {
            // Stripe requires fields to be explicitly set to null if they are not provided
            billing_details: {
              name: data.customer_name,
              email: data.customer_email,
              address: {
                line1: data.customer_billing_address?.line1 || null,
                line2: data.customer_billing_address?.line2 || null,
                postal_code: data.customer_billing_address?.postal_code || null,
                city: data.customer_billing_address?.city || null,
                state: data.customer_billing_address?.state || null,
                country: data.customer_billing_address?.country || null,
              },
              phone: null,
            },
          },
        },
      })
      confirmationToken = confirmationTokenResponse.confirmationToken
      error = confirmationTokenResponse.error
    } catch (err) {
      setLoading(false)
      throw err
    }

    if (!confirmationToken || error) {
      setError('root', {
        message:
          error?.message ||
          'Failed to create confirmation token, please try again later.',
      })
      setLoading(false)
      return
    }

    let updatedCheckout: CheckoutPublicConfirmed
    try {
      updatedCheckout = await onCheckoutConfirm({
        ...data,
        confirmation_token_id: confirmationToken.id,
      })
    } catch (e) {
      setLoading(false)
      return
    }

    setLoadingLabel('Payment successful! Getting your products ready')

    const { intent_status, intent_client_secret } =
      updatedCheckout.payment_processor_metadata as Record<string, string>

    if (intent_status === 'requires_action') {
      const { error } = await stripe.handleNextAction({
        clientSecret: intent_client_secret,
      })
      if (error) {
        setLoading(false)
        setError('root', { message: error.message })
        return
      }
    }

    await onSuccess(
      updatedCheckout.success_url,
      updatedCheckout.customer_session_token,
    )
  }

  const inputBoxShadow =
    theme === 'dark'
      ? 'none'
      : 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'
  const focusBoxShadow =
    theme === 'dark'
      ? 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 71, 184, 0.4) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'
      : 'rgb(255, 255, 255) 0px 0px 0px 0px, rgb(204, 224, 255) 0px 0px 0px 3px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'

  return (
    <Elements
      stripe={stripePromise}
      options={{
        ...elementsOptions,
        customerSessionClientSecret: (
          checkout.payment_processor_metadata as {
            customer_session_client_secret?: string
          }
        ).customer_session_client_secret,
        appearance: {
          theme: theme === 'dark' ? 'night' : 'stripe',
          rules: {
            '.Label': {
              color: theme === 'dark' ? 'white' : 'black',
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '8px',
            },
            '.PickerItem': {
              padding: '12px',
              backgroundColor: theme === 'dark' ? 'rgb(28 28 34)' : 'white',
              color: theme === 'dark' ? '#E5E5E1' : '#181A1F',
              borderRadius: '9999px',
              boxShadow: inputBoxShadow,
              borderColor: 'transparent',
            },
            '.PickerItem--selected': {
              backgroundColor: theme === 'dark' ? 'rgb(28 28 34)' : 'white',
              borderColor: '#0062FF',
              borderWidth: '2px',
            },
            '.PickerItem--selected:hover': {
              backgroundColor: theme === 'dark' ? 'rgb(28 28 34)' : 'white',
            },
            '.Input': {
              padding: '12px',
              backgroundColor: theme === 'dark' ? 'rgb(21, 22, 25)' : 'white',
              color: theme === 'dark' ? '#E5E5E1' : '#181A1F',
              borderRadius: '9999px',
              borderColor: theme === 'dark' ? 'rgb(28, 29, 33)' : '#EEE',
              boxShadow: inputBoxShadow,
            },
            '.Input:focus': {
              borderColor:
                theme === 'dark' ? 'rgb(0, 84, 219)' : 'rgb(102, 161, 255)',
              boxShadow: focusBoxShadow,
            },
            '.Tab': {
              backgroundColor: theme === 'dark' ? 'rgb(21 22 25)' : 'white',
              borderColor: theme === 'dark' ? 'rgb(28, 29, 33)' : '#EEE',
            },
            '.Tab--selected': {
              backgroundColor: 'rgb(51, 129, 255)',
              boxShadow: focusBoxShadow,
              border: 'none',
            },
            '.Tab:focus': {
              boxShadow: focusBoxShadow,
            },
            '.TabLabel--selected': {
              color: 'white',
            },
            '.TabIcon--selected': {
              fill: 'white',
            },
            '.Block': {
              backgroundColor: 'transparent',
              borderColor: theme === 'dark' ? '#353641' : '#EEE',
            },
          },
          variables: {
            borderRadius: '8px',
            fontSizeBase: '0.875rem',
            spacingGridRow: '18px',
            colorDanger: theme === 'dark' ? '#F17878' : '#E64D4D',
          },
        },
      }}
    >
      <ElementsConsumer>
        {({ stripe, elements }) => (
          <BaseCheckoutForm
            {...props}
            checkout={checkout}
            onSubmit={(data) => onSubmit(data, stripe, elements)}
            onCheckoutUpdate={onCheckoutUpdate}
            loading={loading}
            loadingLabel={loadingLabel}
          >
            {checkout.is_payment_form_required && (
              <PaymentElement
                options={{
                  fields: {
                    billingDetails: {
                      name: 'never',
                      email: 'never',
                      phone: 'never',
                      address: 'never',
                    },
                  },
                }}
              />
            )}
          </BaseCheckoutForm>
        )}
      </ElementsConsumer>
    </Elements>
  )
}

const DummyCheckoutForm = ({ checkout }: CheckoutFormProps) => {
  return (
    <BaseCheckoutForm
      checkout={checkout}
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
