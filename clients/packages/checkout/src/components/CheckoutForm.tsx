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
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { cn } from '@polar-sh/ui/lib/utils'
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
import { useDebouncedCallback } from '../hooks/debounce'
import { getDiscountDisplay } from '../utils/discount'
import { formatCurrencyNumber } from '../utils/money'
import { getMeteredPrices, hasLegacyRecurringPrices } from '../utils/product'
import AmountLabel from './AmountLabel'
import CustomFieldInput from './CustomFieldInput'
import MeteredPriceLabel from './MeteredPriceLabel'
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
  themePreset: ThemingPresetProps
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
  themePreset: themePresetProps,
}: React.PropsWithChildren<BaseCheckoutFormProps>) => {
  const interval = hasLegacyRecurringPrices(checkout.product)
    ? checkout.productPrice.recurringInterval
    : checkout.product.recurringInterval
  const {
    control,
    handleSubmit,
    watch,
    clearErrors,
    resetField,
    setValue,
    formState: { errors },
  } = form

  const discount = checkout.discount
  const isDiscountWithoutCode = discount && discount.code === null

  const { product, productPrice } = checkout
  const meteredPrices = useMemo(() => getMeteredPrices(product), [product])
  const onlyMeteredPrices = useMemo(
    () => meteredPrices.length === product.prices.length,
    [meteredPrices, product],
  )

  const country = watch('customerBillingAddress.country')
  const watcher: WatchObserver<CheckoutUpdatePublic> = useCallback(
    async (value, { name }) => {
      if (!name) {
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

  const onSubmit = async (data: CheckoutUpdatePublic) => {
    // Don't send undefined/null data in the custom field object to please the SDK
    const cleanedFieldData = data.customFieldData
      ? Object.fromEntries(
          Object.entries(data.customFieldData).filter(
            ([_, value]) => value !== undefined && value !== null,
          ),
        )
      : {}

    // Avoid overwriting a programmatically set discount without a code.
    if (!data.discountCode && isDiscountWithoutCode) {
      delete data.discountCode
    }
    await confirm({
      ...data,
      customFieldData: cleanedFieldData,
    })
  }

  const checkoutDiscounted = !!checkout.discount

  // Make sure to clear the discount code field if the discount is removed by the API
  useEffect(() => {
    if (!checkout.discount) {
      resetField('discountCode')
    }
  }, [checkout, resetField])

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
                        className={themePresetProps.polar.input}
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
                            className={themePresetProps.polar.input}
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
                    {checkout.customerBillingAddressFields.country && (
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
                                className={themePresetProps.polar.dropdown}
                                itemClassName={
                                  themePresetProps.polar.dropdownItem
                                }
                                contentClassName={
                                  themePresetProps.polar.dropdownContent
                                }
                              />
                              <FormMessage />
                            </>
                          )}
                        />
                      </FormControl>
                    )}
                    {checkout.customerBillingAddressFields.state && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customerBillingAddress.state"
                          rules={{
                            required:
                              country === 'US' || country === 'CA'
                                ? 'This field is required'
                                : false,
                          }}
                          render={({ field }) => (
                            <>
                              <CountryStatePicker
                                autoComplete="billing address-level1"
                                country={country}
                                value={field.value || ''}
                                onChange={field.onChange}
                                className={themePresetProps.polar.dropdown}
                                itemClassName={
                                  themePresetProps.polar.dropdownItem
                                }
                                contentClassName={
                                  themePresetProps.polar.dropdownContent
                                }
                              />
                              <FormMessage />
                            </>
                          )}
                        />
                      </FormControl>
                    )}
                    {checkout.customerBillingAddressFields.line1 && (
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
                                className={themePresetProps.polar.input}
                                {...field}
                                value={field.value || ''}
                              />
                              <FormMessage />
                            </>
                          )}
                        />
                      </FormControl>
                    )}
                    {checkout.customerBillingAddressFields.line2 && (
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
                                className={themePresetProps.polar.input}
                                {...field}
                                value={field.value || ''}
                              />
                              <FormMessage />
                            </>
                          )}
                        />
                      </FormControl>
                    )}
                    <div className="grid grid-cols-2 gap-x-2">
                      {checkout.customerBillingAddressFields.postalCode && (
                        <FormControl>
                          <FormField
                            control={control}
                            name="customerBillingAddress.postalCode"
                            rules={{
                              required: 'This field is required',
                            }}
                            render={({ field }) => (
                              <div>
                                <Input
                                  type="text"
                                  autoComplete="billing postal-code"
                                  placeholder="Postal code"
                                  className={themePresetProps.polar.input}
                                  {...field}
                                  value={field.value || ''}
                                />
                                <FormMessage />
                              </div>
                            )}
                          />
                        </FormControl>
                      )}
                      {checkout.customerBillingAddressFields.city && (
                        <FormControl>
                          <FormField
                            control={control}
                            name="customerBillingAddress.city"
                            rules={{
                              required: 'This field is required',
                            }}
                            render={({ field }) => (
                              <div>
                                <Input
                                  type="text"
                                  autoComplete="billing address-level2"
                                  placeholder="City"
                                  className={themePresetProps.polar.input}
                                  {...field}
                                  value={field.value || ''}
                                />
                                <FormMessage />
                              </div>
                            )}
                          />
                        </FormControl>
                      )}
                    </div>
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
                                className={themePresetProps.polar.input}
                                {...field}
                                value={field.value || ''}
                              />
                              <div className="absolute inset-y-0 right-1 z-10 flex items-center">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => clearTaxId()}
                                  className={themePresetProps.polar.button}
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
                            className={themePresetProps.polar.input}
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
                                size="sm"
                                onClick={addDiscountCode}
                                className={themePresetProps.polar.button}
                              >
                                Apply
                              </Button>
                            )}
                            {checkoutDiscounted && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
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
                    name={`customFieldData.${customField.slug}`}
                    rules={{
                      required: required ? 'This field is required' : undefined,
                    }}
                    render={({ field }) => (
                      <CustomFieldInput
                        customField={customField}
                        required={required}
                        field={field}
                        themePreset={themePresetProps}
                      />
                    )}
                  />
                ),
              )}
            </div>
            {!checkout.isFreeProductPrice && (
              <div className="flex flex-col gap-y-2">
                {checkout.currency ? (
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
                          -checkout.discountAmount,
                          checkout.currency,
                        )}
                      </DetailRow>
                    )}
                    {checkout.taxAmount !== null && (
                      <DetailRow title="Taxes">
                        {formatCurrencyNumber(
                          checkout.taxAmount,
                          checkout.currency,
                        )}
                      </DetailRow>
                    )}
                    <DetailRow title="Total" emphasis>
                      <AmountLabel
                        amount={checkout.totalAmount}
                        currency={checkout.currency}
                        interval={interval}
                      />
                    </DetailRow>
                    {meteredPrices.length > 0 && (
                      <DetailRow title="Additional metered usage" emphasis />
                    )}
                    {meteredPrices.map((meteredPrice) => (
                      <DetailRow
                        title={meteredPrice.meter.name}
                        key={meteredPrice.id}
                      >
                        <MeteredPriceLabel price={meteredPrice} />
                      </DetailRow>
                    ))}
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
                className={cn(themePresetProps.polar.button, 'w-full')}
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
      <a
        href="https://polar.sh?utm_source=checkout"
        className="dark:text-polar-600 flex w-full flex-row items-center justify-center gap-x-3 text-sm text-gray-400"
        target="_blank"
      >
        <span>Powered by</span>
        <PolarLogo className="h-5" />
      </a>
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
  themePreset: ThemingPresetProps
}

const StripeCheckoutForm = (props: CheckoutFormProps) => {
  const {
    checkout,
    update,
    confirm,
    loading,
    loadingLabel,
    themePreset: themePresetProps,
  } = props
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
        appearance: themePresetProps.stripe,
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
                  layout: 'tabs',
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
