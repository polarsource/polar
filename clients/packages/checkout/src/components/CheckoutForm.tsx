'use client'

import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker from '@polar-sh/ui/components/atoms/CountryStatePicker'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import {
  Elements,
  ElementsConsumer,
  PaymentElement,
} from '@stripe/react-stripe-js'
import {
  loadStripe,
  Stripe,
  StripeElements,
  StripeElementsOptions,
} from '@stripe/stripe-js'
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { UseFormReturn, WatchObserver } from 'react-hook-form'
import useDebouncedCallback from '../hooks/debounce'
import { getDiscountDisplay } from '../utils/discount'
import { formatCurrencyNumber } from '../utils/money'
import AmountLabel from './AmountLabel'
import CustomFieldInput from './CustomFieldInput'
import PolarLogo from './PolarLogo'

const DetailRow = ({
  title,
  emphasis,
  children,
}: PropsWithChildren<{ title: string; emphasis?: boolean }>) => {
  return (
    <div
      className={`flex flex-row items-center justify-between gap-x-8 ${emphasis ? 'font-medium' : 'dark:text-polar-500 text-gray-500'}`}
    >
      <span>{title}</span>
      {children}
    </div>
  )
}

const XIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

interface BaseCheckoutFormProps {
  form: UseFormReturn<CheckoutUpdatePublic>
  checkout: CheckoutPublic
  confirm: (data: any) => Promise<CheckoutPublicConfirmed>
  update: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  loading: boolean
  loadingLabel: string | undefined
  disabled?: boolean
}

const BaseCheckoutForm = ({
  form,
  checkout,
  confirm,
  update,
  loading,
  loadingLabel,
  disabled,
  children,
}: React.PropsWithChildren<BaseCheckoutFormProps>) => {
  const interval =
    checkout.productPrice.type === 'recurring'
      ? checkout.productPrice.recurringInterval
      : undefined
  const {
    control,
    handleSubmit,
    watch,
    clearErrors,
    resetField,
    setValue,
    formState: { errors },
  } = form
  const country = watch('customerBillingAddress.country')
  const watcher: WatchObserver<CheckoutUpdatePublic> = useCallback(
    async (value, { name, type }) => {
      if (type !== 'change' || !name) {
        return
      }

      let payload: CheckoutUpdatePublic = {}
      // Update Tax ID
      if (name === 'customerTaxId') {
        payload = {
          ...payload,
          customerTaxId: value.customerTaxId,
          // Make sure the address is up-to-date while updating the tax ID
          ...(value.customerBillingAddress &&
          value.customerBillingAddress.country
            ? {
                customerBillingAddress: {
                  ...value.customerBillingAddress,
                  country: value.customerBillingAddress.country,
                },
              }
            : {}),
        }
        clearErrors('customerTaxId')
        // Update country, make sure to reset other address fields
      } else if (name === 'customerBillingAddress.country') {
        const { customerBillingAddress } = value
        if (customerBillingAddress && customerBillingAddress.country) {
          payload = {
            ...payload,
            customerBillingAddress: {
              country: customerBillingAddress.country,
            },
          }
          resetField('customerBillingAddress', {
            defaultValue: { country: customerBillingAddress.country },
          })
        }
        // Update other address fields
      } else if (name.startsWith('customerBillingAddress')) {
        const { customerBillingAddress } = value
        if (customerBillingAddress && customerBillingAddress.country) {
          payload = {
            ...payload,
            customerBillingAddress: {
              ...customerBillingAddress,
              country: customerBillingAddress.country,
            },
          }
          clearErrors('customerBillingAddress')
        }
      } else if (name === 'discountCode') {
        const { discountCode } = value
        clearErrors('discountCode')
        // Ensure we don't submit an empty discount code
        if (discountCode === '') {
          setValue('discountCode', undefined)
        }
      }

      if (Object.keys(payload).length === 0) {
        return
      }

      try {
        await update(payload)
      } catch {}
    },
    [clearErrors, resetField, update, setValue],
  )
  const debouncedWatcher = useDebouncedCallback(watcher, 500, [watcher])

  const discountCode = watch('discountCode')
  const addDiscountCode = useCallback(async () => {
    if (!discountCode) {
      return
    }
    clearErrors('discountCode')
    try {
      await update({ discountCode: discountCode })
    } catch {}
  }, [update, discountCode, clearErrors])
  const removeDiscountCode = useCallback(async () => {
    clearErrors('discountCode')
    try {
      await update({ discountCode: null })
      resetField('discountCode')
    } catch {}
  }, [update, clearErrors, resetField])

  useEffect(() => {
    const subscription = watch(debouncedWatcher)
    return () => subscription.unsubscribe()
  }, [watch, debouncedWatcher])

  const taxId = watch('customerTaxId')
  const [showTaxId, setShowTaxID] = useState(false)
  const clearTaxId = useCallback(() => {
    setValue('customerTaxId', '')
    setShowTaxID(false)
  }, [setValue])
  useEffect(() => {
    if (taxId) {
      setShowTaxID(true)
    }
  }, [taxId])

  const checkoutDiscounted = !!checkout.discount

  return (
    <div className="flex flex-col justify-between gap-y-24">
      <div className="flex flex-col gap-y-12">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(confirm)}
            className="flex flex-col gap-y-12"
          >
            <div className="flex flex-col gap-y-6">
              <FormField
                control={control}
                name="customerEmail"
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
                        disabled={checkout.customerId !== null}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {children}

              {checkout.isPaymentFormRequired && (
                <>
                  <FormField
                    control={control}
                    name="customerName"
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
                        name="customerBillingAddress.country"
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
                          name="customerBillingAddress.state"
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
                            name="customerBillingAddress.line1"
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
                            name="customerBillingAddress.line2"
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
                              name="customerBillingAddress.postalCode"
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
                              name="customerBillingAddress.city"
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
                    {errors.customerBillingAddress?.message && (
                      <p className="text-destructive-foreground text-sm">
                        {errors.customerBillingAddress.message}
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
                      name="customerTaxId"
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
                                  <XIcon className="h-4 w-4" />
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
              {checkout.allowDiscountCodes && checkout.isDiscountApplicable && (
                <FormField
                  control={control}
                  name="discountCode"
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
                            disabled={checkoutDiscounted}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return

                              e.preventDefault()
                              addDiscountCode()
                            }}
                          />
                          <div className="absolute inset-y-0 right-1 z-10 flex items-center">
                            {!checkoutDiscounted && discountCode && (
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={addDiscountCode}
                              >
                                Apply
                              </Button>
                            )}
                            {checkoutDiscounted && (
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={removeDiscountCode}
                              >
                                <XIcon className="h-4 w-4" />
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
              {checkout.attachedCustomFields.map(
                ({ customField, required }) => (
                  <FormField
                    key={customField.id}
                    control={control}
                    // @ts-ignore
                    name={`customFieldFata.${customField.slug}`}
                    render={({ field }) => (
                      <CustomFieldInput
                        customField={customField}
                        required={required}
                        // @ts-ignore
                        field={field}
                      />
                    )}
                  />
                ),
              )}
            </div>
            {!checkout.isFreeProductPrice && (
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
                        {formatCurrencyNumber(
                          (checkout.subtotalAmount || 0) - checkout.amount,
                          checkout.currency,
                        )}
                      </DetailRow>
                    )}
                    {checkout.taxAmount !== null && (
                      <DetailRow title="VAT / Sales Tax">
                        {formatCurrencyNumber(
                          checkout.taxAmount,
                          checkout.currency,
                        )}
                      </DetailRow>
                    )}
                    <DetailRow title="Total" emphasis>
                      <AmountLabel
                        amount={checkout.totalAmount || 0}
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
                {!checkout.isPaymentFormRequired
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
        <PolarLogo className="h-5" />
      </div>
    </div>
  )
}

interface CheckoutFormProps {
  form: UseFormReturn<CheckoutUpdatePublic>
  checkout: CheckoutPublic
  update: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  confirm: (
    data: CheckoutConfirmStripe,
    stripe: Stripe | null,
    elements: StripeElements | null,
  ) => Promise<CheckoutPublicConfirmed>
  loading: boolean
  loadingLabel: string | undefined
  theme?: 'light' | 'dark'
}

const StripeCheckoutForm = (props: CheckoutFormProps) => {
  const { checkout, update, confirm, loading, loadingLabel, theme } = props
  const {
    paymentProcessorMetadata: { publishable_key },
  } = checkout
  const stripePromise = useMemo(
    () => loadStripe(publishable_key),
    [publishable_key],
  )

  const elementsOptions = useMemo<StripeElementsOptions>(() => {
    if (
      checkout.isPaymentSetupRequired &&
      checkout.isPaymentRequired &&
      checkout.totalAmount
    ) {
      return {
        mode: 'subscription',
        setupFutureUsage: 'off_session',
        paymentMethodCreation: 'manual',
        amount: checkout.totalAmount,
        currency: checkout.currency || 'usd',
      }
    } else if (checkout.isPaymentRequired && checkout.totalAmount) {
      return {
        mode: 'payment',
        paymentMethodCreation: 'manual',
        amount: checkout.totalAmount,
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
          checkout.paymentProcessorMetadata as {
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
              backgroundColor:
                theme === 'dark' ? 'rgb(26.4, 26.8, 29.7)' : 'white',
              color: theme === 'dark' ? '#E5E5E1' : '#181A1F',
              borderRadius: '9999px',
              borderColor: theme === 'dark' ? 'rgb(36, 36.5, 40.5)' : '#EEE',
              boxShadow: inputBoxShadow,
            },
            '.Input:focus': {
              borderColor:
                theme === 'dark' ? 'rgb(0, 84, 219)' : 'rgb(102, 161, 255)',
              boxShadow: focusBoxShadow,
            },
            '.Tab': {
              backgroundColor:
                theme === 'dark' ? 'rgb(26.4, 26.8, 29.7)' : 'white',
              borderColor: theme === 'dark' ? 'rgb(36, 36.5, 40.5)' : '#EEE',
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
            confirm={(data) => confirm(data, stripe, elements)}
            update={update}
            loading={loading}
            loadingLabel={loadingLabel}
          >
            {checkout.isPaymentFormRequired && (
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

const DummyCheckoutForm = (props: CheckoutFormProps) => {
  const { checkout } = props
  return (
    <BaseCheckoutForm
      {...props}
      confirm={async () => ({
        ...checkout,
        status: 'confirmed',
        customerSessionToken: '',
      })}
      update={async () => checkout}
      disabled={true}
    />
  )
}

const CheckoutForm = (props: CheckoutFormProps) => {
  const {
    checkout: { paymentProcessor },
  } = props

  if (paymentProcessor === 'stripe') {
    return <StripeCheckoutForm {...props} />
  }
  return <DummyCheckoutForm {...props} />
}

export default CheckoutForm
