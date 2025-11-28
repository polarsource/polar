'use client'

import { CountryAlpha2Input } from '@polar-sh/sdk/models/components/addressinput'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker from '@polar-sh/ui/components/atoms/CountryStatePicker'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
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
import { PropsWithChildren, useCallback, useEffect, useMemo } from 'react'
import { UseFormReturn, WatchObserver } from 'react-hook-form'
import { hasProductCheckout } from '../guards'
import { useDebouncedCallback } from '../hooks/debounce'
import { isDisplayedField, isRequiredField } from '../utils/address'
import { getDiscountDisplay } from '../utils/discount'
import { formatCurrencyNumber } from '../utils/money'
import {
  formatRecurringInterval,
  getMeteredPrices,
  hasLegacyRecurringPrices,
} from '../utils/product'
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
      className={`flex flex-row items-start justify-between gap-x-8 ${emphasis ? 'font-medium' : 'dark:text-polar-500 text-gray-500'}`}
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
  isUpdatePending?: boolean
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
  isUpdatePending,
  children,
  themePreset: themePresetProps,
}: React.PropsWithChildren<BaseCheckoutFormProps>) => {
  const interval = hasProductCheckout(checkout)
    ? hasLegacyRecurringPrices(checkout.prices[checkout.product.id])
      ? checkout.productPrice.recurringInterval
      : checkout.product.recurringInterval
    : null
  const intervalCount = hasProductCheckout(checkout)
    ? checkout.product.recurringIntervalCount
    : null
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

  const { product, prices, isBusinessCustomer } = checkout
  const meteredPrices = useMemo(
    () => (product && prices ? getMeteredPrices(prices[product.id]) : []),
    [product],
  )

  const country = watch('customerBillingAddress.country')
  const watcher: WatchObserver<CheckoutUpdatePublic> = useCallback(
    async (value, { name }) => {
      if (!name) {
        return
      }

      let payload: CheckoutUpdatePublic = {}
      // Update country, make sure to reset other address fields
      if (name === 'customerBillingAddress.country') {
        const { customerBillingAddress } = value
        if (customerBillingAddress && customerBillingAddress.country) {
          payload = {
            ...payload,
            customerBillingAddress: {
              country: customerBillingAddress.country,
            },
          }
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
      }

      if (Object.keys(payload).length === 0) {
        return
      }

      try {
        await update(payload)
      } catch {}
    },
    [clearErrors, update],
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
    if (!discountCode && !checkout.discount) {
      clearErrors('discountCode')
    }
  }, [discountCode, checkout.discount, clearErrors])

  const updateBusinessCustomer = useCallback(
    async (isBusinessCustomer: boolean) => {
      try {
        await update({ isBusinessCustomer })
      } catch {}
    },
    [update],
  )

  useEffect(() => {
    const subscription = watch(debouncedWatcher)
    return () => subscription.unsubscribe()
  }, [watch, debouncedWatcher])

  const taxId = watch('customerTaxId')
  const addTaxID = useCallback(async () => {
    if (!taxId) {
      return
    }
    clearErrors('customerTaxId')
    try {
      await update({ customerTaxId: taxId })
    } catch {}
  }, [update, taxId, clearErrors])
  const clearTaxId = useCallback(async () => {
    clearErrors('customerTaxId')
    try {
      await update({ customerTaxId: null })
      resetField('customerTaxId')
    } catch {}
  }, [update, clearErrors, resetField])

  const onSubmit = async (data: CheckoutUpdatePublic) => {
    // Don't send undefined/null data in the custom field object to please the SDK
    const cleanedFieldData = data.customFieldData
      ? Object.fromEntries(
          Object.entries(data.customFieldData).filter(
            ([_, value]) => value !== undefined && value !== null,
          ),
        )
      : {}

    if (
      data.discountCode === '' ||
      // Avoid overwriting a programmatically set discount without a code.
      (!data.discountCode && isDiscountWithoutCode)
    ) {
      delete data.discountCode
    }

    await confirm({
      ...data,
      customFieldData: cleanedFieldData,
    })
  }

  const checkoutDiscounted = !!checkout.discount
  const validTaxID = !!checkout.customerTaxId

  // Make sure to clear the discount code field if the discount is removed by the API
  useEffect(() => {
    if (!checkout.discount) {
      resetField('discountCode')
    }
  }, [checkout, resetField])

  const formattedDiscountDuration = useMemo(() => {
    if (!checkout.discount) {
      return ''
    }

    if (!interval) {
      return ''
    }

    if (checkout.discount.duration === 'forever') {
      return ''
    }

    if (checkout.discount.duration === 'once') {
      // For "once" with an interval count > 1, describe the actual billing period
      if (intervalCount && intervalCount > 1) {
        const pluralInterval = `${interval}${intervalCount > 1 ? 's' : ''}`
        return `for the first ${intervalCount} ${pluralInterval}`
      }
      return `for the first ${interval}`
    }

    const durationInMonths =
      'durationInMonths' in checkout.discount && checkout.discount
        ? checkout.discount.durationInMonths
        : -1

    // Discount duration is always in months, so a 13 month discount on a yearly billing schedule
    // will apply on the first two years.
    // For clarity, we convert that here.
    // When we ship other intervals like daily or weekly, "for the first xyz months" is probably
    // better language than "for the first xyz days" anyway.
    const calculatedDuration =
      interval === 'year' ? Math.ceil(durationInMonths / 12) : durationInMonths

    if (calculatedDuration <= 1) {
      // For single period with interval count > 1, describe the actual billing period
      if (intervalCount && intervalCount > 1) {
        const pluralInterval = `${interval}${intervalCount > 1 ? 's' : ''}`
        return `for the first ${intervalCount} ${pluralInterval}`
      }
      return `for the first ${interval}`
    }

    return `for the first ${calculatedDuration} ${interval === 'year' ? 'years' : 'months'}`
  }, [checkout.discount, interval, intervalCount])

  const totalLabel = useMemo(() => {
    if (interval) {
      const formatted = formatRecurringInterval(interval, intervalCount, 'long')
      return `Every ${formatted}`
    }

    return 'Total'
  }, [interval, intervalCount])

  const checkoutLabel = useMemo(() => {
    if (checkout.activeTrialInterval) {
      return `Start Trial`
    }

    if (checkout.isPaymentFormRequired) {
      return interval ? 'Subscribe' : 'Pay'
    }

    return 'Submit'
  }, [checkout, interval])

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
              )}

              {(checkout.isPaymentFormRequired ||
                checkout.requireBillingAddress) && (
                <>
                  <FormField
                    control={control}
                    name="isBusinessCustomer"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-row items-center space-y-0 space-x-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value ? field.value : false}
                              onCheckedChange={(checked) => {
                                if (isUpdatePending) {
                                  return
                                }

                                field.onChange(checked)
                                updateBusinessCustomer(!!checked)
                              }}
                            />
                          </FormControl>
                          <FormLabel>
                            I&apos;m purchasing as a business
                          </FormLabel>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isBusinessCustomer && (
                    <FormField
                      control={control}
                      name="customerBillingName"
                      rules={{
                        required: 'This field is required',
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business name</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              autoComplete="billing organization"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormItem>
                    <FormLabel>Billing address</FormLabel>
                    {isDisplayedField(checkout.billingAddressFields.line1) && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customerBillingAddress.line1"
                          rules={{
                            required: isRequiredField(
                              checkout.billingAddressFields.line1,
                            )
                              ? 'This field is required'
                              : false,
                          }}
                          render={({ field }) => (
                            <>
                              <Input
                                type="text"
                                autoComplete="billing address-line1"
                                placeholder="Line 1"
                                {...field}
                                value={field.value || ''}
                              />
                              <FormMessage />
                            </>
                          )}
                        />
                      </FormControl>
                    )}
                    {isDisplayedField(checkout.billingAddressFields.line2) && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customerBillingAddress.line2"
                          rules={{
                            required: isRequiredField(
                              checkout.billingAddressFields.line2,
                            )
                              ? 'This field is required'
                              : false,
                          }}
                          render={({ field }) => (
                            <>
                              <Input
                                type="text"
                                autoComplete="billing address-line2"
                                placeholder="Line 2"
                                {...field}
                                value={field.value || ''}
                              />
                              <FormMessage />
                            </>
                          )}
                        />
                      </FormControl>
                    )}
                    {(isDisplayedField(
                      checkout.billingAddressFields.postalCode,
                    ) ||
                      isDisplayedField(checkout.billingAddressFields.city)) && (
                      <div className="grid grid-cols-2 gap-x-2">
                        {isDisplayedField(
                          checkout.billingAddressFields.postalCode,
                        ) && (
                          <FormControl>
                            <FormField
                              control={control}
                              name="customerBillingAddress.postalCode"
                              rules={{
                                required: isRequiredField(
                                  checkout.billingAddressFields.postalCode,
                                )
                                  ? 'This field is required'
                                  : false,
                              }}
                              render={({ field }) => (
                                <div>
                                  <Input
                                    type="text"
                                    autoComplete="billing postal-code"
                                    placeholder="Postal code"
                                    {...field}
                                    value={field.value || ''}
                                  />
                                  <FormMessage />
                                </div>
                              )}
                            />
                          </FormControl>
                        )}
                        {isDisplayedField(
                          checkout.billingAddressFields.city,
                        ) && (
                          <FormControl>
                            <FormField
                              control={control}
                              name="customerBillingAddress.city"
                              rules={{
                                required: isRequiredField(
                                  checkout.billingAddressFields.city,
                                )
                                  ? 'This field is required'
                                  : false,
                              }}
                              render={({ field }) => (
                                <div>
                                  <Input
                                    type="text"
                                    autoComplete="billing address-level2"
                                    placeholder="City"
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
                    )}
                    {isDisplayedField(checkout.billingAddressFields.state) && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customerBillingAddress.state"
                          rules={{
                            required: isRequiredField(
                              checkout.billingAddressFields.state,
                            )
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
                              />
                              <FormMessage />
                            </>
                          )}
                        />
                      </FormControl>
                    )}
                    {isDisplayedField(
                      checkout.billingAddressFields.country,
                    ) && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customerBillingAddress.country"
                          rules={{
                            required: isRequiredField(
                              checkout.billingAddressFields.country,
                            )
                              ? 'This field is required'
                              : false,
                          }}
                          render={({ field }) => (
                            <>
                              <CountryPicker
                                allowedCountries={Object.values(
                                  CountryAlpha2Input,
                                )}
                                autoComplete="billing country"
                                value={field.value || undefined}
                                onChange={field.onChange}
                              />
                              <FormMessage />
                            </>
                          )}
                        />
                      </FormControl>
                    )}
                    {errors.customerBillingAddress?.message && (
                      <p className="text-destructive-foreground text-sm">
                        {errors.customerBillingAddress.message}
                      </p>
                    )}
                  </FormItem>

                  {isBusinessCustomer && (
                    <FormField
                      control={control}
                      name="customerTaxId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex flex-row items-center justify-between">
                            <div>Tax ID</div>
                            <div className="dark:text-polar-500 text-xs text-gray-500">
                              Optional
                            </div>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="text"
                                autoComplete="off"
                                {...field}
                                value={field.value || ''}
                                disabled={validTaxID}
                              />
                              <div className="absolute inset-y-0 right-1 z-10 flex items-center gap-1">
                                {!validTaxID && taxId && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={addTaxID}
                                  >
                                    Apply
                                  </Button>
                                )}
                                {validTaxID && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => clearTaxId()}
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
                </>
              )}
              {checkout.allowDiscountCodes && checkout.isDiscountApplicable && (
                <FormField
                  control={control}
                  name="discountCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex flex-row items-center justify-between">
                        <div>Discount code</div>
                        <div className="dark:text-polar-500 text-xs font-normal text-gray-500">
                          Optional
                        </div>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="text"
                            autoComplete="off"
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
              {checkout.attachedCustomFields &&
                checkout.attachedCustomFields.map(
                  ({ customField, required }) => (
                    <FormField
                      key={customField.id}
                      control={control}
                      name={`customFieldData.${customField.slug}`}
                      rules={{
                        required: required
                          ? 'This field is required'
                          : undefined,
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
                        intervalCount={intervalCount}
                      />
                    </DetailRow>

                    {checkout.discount && (
                      <>
                        <DetailRow
                          title={`${checkout.discount.name} (${getDiscountDisplay(checkout.discount)})`}
                        >
                          {formatCurrencyNumber(
                            -checkout.discountAmount,
                            checkout.currency,
                            checkout.discountAmount % 100 === 0 ? 0 : 2,
                          )}
                        </DetailRow>
                        <DetailRow title="Taxable amount">
                          {formatCurrencyNumber(
                            checkout.netAmount,
                            checkout.currency,
                            checkout.netAmount % 100 === 0 ? 0 : 2,
                          )}
                        </DetailRow>
                      </>
                    )}

                    <DetailRow title="Taxes">
                      {checkout.taxAmount !== null
                        ? formatCurrencyNumber(
                            checkout.taxAmount,
                            checkout.currency,
                            checkout.taxAmount % 100 === 0 ? 0 : 2,
                          )
                        : '—'}
                    </DetailRow>

                    <DetailRow title={totalLabel} emphasis>
                      <div className="flex flex-col items-end gap-y-1">
                        <AmountLabel
                          amount={checkout.totalAmount}
                          currency={checkout.currency}
                          interval={interval}
                          intervalCount={intervalCount}
                        />
                        {formattedDiscountDuration && (
                          <span className="text-xs font-normal text-gray-500">
                            {formattedDiscountDuration}
                          </span>
                        )}
                      </div>
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
                {(checkout.trialEnd ||
                  (checkout.activeTrialInterval &&
                    checkout.activeTrialIntervalCount)) && (
                  <div className="dark:border-polar-700 mt-3 border-t border-gray-300 pt-4">
                    {checkout.activeTrialInterval &&
                      checkout.activeTrialIntervalCount && (
                        <DetailRow
                          emphasis
                          title={`${checkout.activeTrialIntervalCount} ${checkout.activeTrialInterval}${checkout.activeTrialIntervalCount > 1 ? 's' : ''} trial`}
                        >
                          <span>Free</span>
                        </DetailRow>
                      )}
                    {checkout.trialEnd && (
                      <span className="dark:text-polar-500 text-gray-500:w text-sm">
                        Trial ends{' '}
                        <FormattedDateTime
                          datetime={checkout.trialEnd}
                          resolution="day"
                        />
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex w-full flex-col items-center justify-center gap-y-2">
              <Button
                type="submit"
                size="lg"
                wrapperClassNames="text-base"
                className={cn('w-full')}
                disabled={disabled || isUpdatePending}
                loading={loading}
              >
                {checkoutLabel}
              </Button>
              {loading && loadingLabel && (
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  {loadingLabel}
                </p>
              )}
              {disabled && !loading && (
                <p className="text-sm text-red-500 dark:text-red-500">
                  Payments are currently unavailable
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
  disabled?: boolean
  isUpdatePending?: boolean
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
    disabled,
    isUpdatePending,
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
        currency: checkout.currency,
      }
    } else if (checkout.isPaymentRequired && checkout.totalAmount) {
      return {
        mode: 'payment',
        paymentMethodCreation: 'manual',
        amount: checkout.totalAmount,
        currency: checkout.currency,
      }
    }

    return {
      mode: 'setup',
      paymentMethodCreation: 'manual',
      setupFutureUsage: 'off_session',
      currency: checkout.currency,
    }
  }, [checkout])

  return (
    <Elements
      stripe={stripePromise}
      options={{
        ...elementsOptions,
        locale: 'en',
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
            isUpdatePending={isUpdatePending}
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
  const { checkout, disabled } = props
  return (
    <BaseCheckoutForm
      {...props}
      confirm={async () => ({
        ...checkout,
        status: 'confirmed',
        customerSessionToken: '',
      })}
      update={async () => checkout}
      disabled={disabled ?? true}
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
