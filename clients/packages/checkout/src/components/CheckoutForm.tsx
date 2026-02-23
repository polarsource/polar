'use client'

import {
  getTranslationLocale,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { CountryAlpha2Input } from '@polar-sh/sdk/models/components/addressinput'
import type { CheckoutConfirmStripe } from '@polar-sh/sdk/models/components/checkoutconfirmstripe'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutPublicConfirmed } from '@polar-sh/sdk/models/components/checkoutpublicconfirmed'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker from '@polar-sh/ui/components/atoms/CountryStatePicker'
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
  StripePaymentElementChangeEvent,
} from '@stripe/stripe-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { UseFormReturn, WatchObserver } from 'react-hook-form'
import { hasProductCheckout } from '../guards'
import { useDebouncedCallback } from '../hooks/debounce'
import { isDisplayedField, isRequiredField } from '../utils/address'
import { hasLegacyRecurringPrices } from '../utils/product'
import CustomFieldInput from './CustomFieldInput'
import PolarLogo from './PolarLogo'

const WALLET_PAYMENT_METHODS = ['apple_pay', 'google_pay'] as const
type WalletPaymentMethod = (typeof WALLET_PAYMENT_METHODS)[number]

const isWalletPaymentMethod = (type: string): type is WalletPaymentMethod =>
  WALLET_PAYMENT_METHODS.includes(type as WalletPaymentMethod)

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
  locale?: AcceptedLocale
  isWalletPayment?: boolean
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
  locale: localeProp,
  isWalletPayment,
}: React.PropsWithChildren<BaseCheckoutFormProps>) => {
  const interval = hasProductCheckout(checkout)
    ? hasLegacyRecurringPrices(checkout.prices[checkout.product.id])
      ? checkout.productPrice.recurringInterval
      : checkout.product.recurringInterval
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

  const locale: AcceptedLocale = localeProp || 'en'

  const t = useTranslations(locale)

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
      locale: localeProp,
      customFieldData: cleanedFieldData,
    })
  }

  const validTaxID = !!checkout.customerTaxId

  // Make sure to clear the discount code field if the discount is removed by the API
  useEffect(() => {
    if (!checkout.discount) {
      resetField('discountCode')
    }
  }, [checkout, resetField])

  const checkoutLabel = useMemo(() => {
    if (checkout.activeTrialInterval) {
      return t('checkout.cta.startTrial')
    }

    if (checkout.isPaymentFormRequired) {
      return interval
        ? t('checkout.cta.subscribeNow')
        : t('checkout.cta.payNow')
    }

    return t('checkout.cta.getFree')
  }, [checkout, interval, t])

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
                  required: t('checkout.form.fieldRequired'),
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('checkout.form.email')}</FormLabel>
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

              {checkout.isPaymentFormRequired && !isWalletPayment && (
                <FormField
                  control={control}
                  name="customerName"
                  rules={{
                    required: t('checkout.form.fieldRequired'),
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('checkout.form.cardholderName')}</FormLabel>
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
                            {t('checkout.form.purchasingAsBusiness')}
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
                        required: t('checkout.form.fieldRequired'),
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('checkout.form.businessName')}
                          </FormLabel>
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
                    <FormLabel>
                      {t('checkout.form.billingAddress.label')}
                    </FormLabel>
                    {isDisplayedField(checkout.billingAddressFields.line1) && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customerBillingAddress.line1"
                          rules={{
                            required: isRequiredField(
                              checkout.billingAddressFields.line1,
                            )
                              ? t('checkout.form.fieldRequired')
                              : false,
                          }}
                          render={({ field }) => (
                            <>
                              <Input
                                type="text"
                                autoComplete="billing address-line1"
                                placeholder={t(
                                  'checkout.form.billingAddress.line1',
                                )}
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
                              ? t('checkout.form.fieldRequired')
                              : false,
                          }}
                          render={({ field }) => (
                            <>
                              <Input
                                type="text"
                                autoComplete="billing address-line2"
                                placeholder={t(
                                  'checkout.form.billingAddress.line2',
                                )}
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
                                  ? t('checkout.form.fieldRequired')
                                  : false,
                              }}
                              render={({ field }) => (
                                <div>
                                  <Input
                                    type="text"
                                    autoComplete="billing postal-code"
                                    placeholder={t(
                                      'checkout.form.billingAddress.postalCode',
                                    )}
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
                                  ? t('checkout.form.fieldRequired')
                                  : false,
                              }}
                              render={({ field }) => (
                                <div>
                                  <Input
                                    type="text"
                                    autoComplete="billing address-level2"
                                    placeholder={t(
                                      'checkout.form.billingAddress.city',
                                    )}
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
                              ? t('checkout.form.fieldRequired')
                              : false,
                          }}
                          render={({ field }) => (
                            <>
                              <CountryStatePicker
                                autoComplete="billing address-level1"
                                country={country}
                                value={field.value || ''}
                                onChange={field.onChange}
                                placeholder={
                                  country === 'US'
                                    ? t('checkout.form.billingAddress.state')
                                    : t('checkout.form.billingAddress.province')
                                }
                                fallbackPlaceholder={t(
                                  'checkout.form.billingAddress.stateProvince',
                                )}
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
                              ? t('checkout.form.fieldRequired')
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
                                placeholder={t(
                                  'checkout.form.billingAddress.country',
                                )}
                                locale={locale}
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
                            <div>{t('checkout.form.taxId')}</div>
                            <div className="dark:text-polar-500 text-xs text-gray-500">
                              {t('checkout.form.optional')}
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
                                    {t('checkout.form.apply')}
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
              {checkout.attachedCustomFields &&
                checkout.attachedCustomFields.map(
                  ({ customField, required }) => (
                    <FormField
                      key={customField.id}
                      control={control}
                      name={`customFieldData.${customField.slug}`}
                      rules={{
                        required: required
                          ? t('checkout.form.fieldRequired')
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
                  {t('checkout.cta.paymentsUnavailable')}
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
          {t('checkout.footer.merchantOfRecord')}
        </p>
      </div>
      <a
        href="https://polar.sh?utm_source=checkout"
        className="dark:text-polar-600 flex w-full flex-row items-center justify-center gap-x-3 text-sm text-gray-400"
        target="_blank"
      >
        <span>{t('checkout.footer.poweredBy')}</span>
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
  locale?: AcceptedLocale
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
    locale,
  } = props
  const {
    paymentProcessorMetadata: { publishable_key },
  } = checkout
  const stripePromise = useMemo(
    () => loadStripe(publishable_key),
    [publishable_key],
  )

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    string | undefined
  >()
  const isWalletPayment = selectedPaymentMethod
    ? isWalletPaymentMethod(selectedPaymentMethod)
    : false

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
        locale: locale ? getTranslationLocale(locale) : undefined,
        customerSessionClientSecret: (
          checkout.paymentProcessorMetadata as {
            customer_session_client_secret?: string
          }
        ).customer_session_client_secret,
        appearance: themePresetProps.stripe,
      }}
    >
      <ElementsConsumer>
        {({
          stripe,
          elements,
        }: {
          elements: StripeElements | null
          stripe: Stripe | null
        }) => (
          <BaseCheckoutForm
            {...props}
            checkout={checkout}
            confirm={(data) => confirm(data, stripe, elements)}
            update={update}
            loading={loading}
            loadingLabel={loadingLabel}
            isUpdatePending={isUpdatePending}
            isWalletPayment={isWalletPayment}
          >
            {checkout.isPaymentFormRequired && (
              <PaymentElement
                options={{
                  paymentMethodOrder: ['apple_pay', 'google_pay', 'card'],
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
                onChange={(event: StripePaymentElementChangeEvent) => {
                  setSelectedPaymentMethod(event.value.type)
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
