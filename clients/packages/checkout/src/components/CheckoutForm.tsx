'use client'

import type { schemas } from '@polar-sh/client'
import { enums } from '@polar-sh/client'
import { useTranslations, type AcceptedLocale } from '@polar-sh/i18n'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker, {
  COUNTRIES_WITH_FIXED_STATE_OPTIONS,
} from '@polar-sh/ui/components/atoms/CountryStatePicker'
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
import { hasProductCheckout, isLegacyRecurringProductPrice } from '../guards'
import { useDebouncedCallback } from '../hooks/debounce'
import { isDisplayedField, isRequiredField } from '../utils/address'
import { convertLocaleToStripeElementLocale } from '../utils/locale'
import CustomFieldInput from './CustomFieldInput'
import PolarLogo from './PolarLogo'

const WALLET_PAYMENT_METHODS = ['apple_pay', 'google_pay', 'link']

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
  form: UseFormReturn<schemas['CheckoutUpdatePublic']>
  checkout: schemas['CheckoutPublic']
  confirm: (
    data: schemas['CheckoutConfirmStripe'],
  ) => Promise<schemas['CheckoutPublicConfirmed']>
  update: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<schemas['CheckoutPublic']>
  loading: boolean
  loadingLabel: string | undefined
  disabled?: boolean
  isUpdatePending?: boolean
  locale?: AcceptedLocale
  isWalletPayment?: boolean
  beforeSubmit?: React.ReactNode
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
  locale: localeProp,
  isWalletPayment,
  beforeSubmit,
}: React.PropsWithChildren<BaseCheckoutFormProps>) => {
  const interval = hasProductCheckout(checkout)
    ? isLegacyRecurringProductPrice(checkout.product_price)
      ? checkout.product_price.recurring_interval
      : checkout.product.recurring_interval
    : null
  const {
    control,
    handleSubmit,
    watch,
    clearErrors,
    resetField,
    formState: { errors },
  } = form

  const discount = checkout.discount
  const isDiscountWithoutCode = discount && discount.code === null

  const { is_business_customer: isBusinessCustomer } = checkout

  const locale: AcceptedLocale = localeProp || 'en'

  const t = useTranslations(locale)

  const country = watch('customer_billing_address.country')
  const watcher: WatchObserver<schemas['CheckoutUpdatePublic']> = useCallback(
    async (value, { name }) => {
      if (!name) {
        return
      }

      let payload: schemas['CheckoutUpdatePublic'] = {}
      // Update country, reset state when switching between select and free-text
      if (name === 'customer_billing_address.country') {
        const { customer_billing_address: customerBillingAddress } = value
        if (customerBillingAddress && customerBillingAddress.country) {
          const newCountry = customerBillingAddress.country
          const prevIsSelect =
            !!country && COUNTRIES_WITH_FIXED_STATE_OPTIONS.includes(country)
          const nextIsSelect =
            COUNTRIES_WITH_FIXED_STATE_OPTIONS.includes(newCountry)
          if (country !== newCountry && (prevIsSelect || nextIsSelect)) {
            resetField('customer_billing_address.state', { defaultValue: '' })
          }
          clearErrors('customer_billing_address')
          payload = {
            ...payload,
            customer_billing_address: {
              country: newCountry,
            },
          }
        }
        // Update other address fields
      } else if (name.startsWith('customer_billing_address')) {
        const { customer_billing_address: customerBillingAddress } = value
        if (customerBillingAddress && customerBillingAddress.country) {
          payload = {
            ...payload,
            customer_billing_address: {
              ...customerBillingAddress,
              country: customerBillingAddress.country,
            },
          }
          clearErrors('customer_billing_address')
        }
      }

      if (Object.keys(payload).length === 0) {
        return
      }

      try {
        await update(payload)
      } catch {
        /* API errors handled by provider */
      }
    },
    [clearErrors, country, resetField, update],
  )
  const debouncedWatcher = useDebouncedCallback(watcher, 500, [watcher])

  const discountCode = watch('discount_code')

  useEffect(() => {
    if (!discountCode && !checkout.discount) {
      clearErrors('discount_code')
    }
  }, [discountCode, checkout.discount, clearErrors])

  const updateBusinessCustomer = useCallback(
    async (isBusinessCustomer: boolean) => {
      try {
        await update({ is_business_customer: isBusinessCustomer })
      } catch {
        /* API errors handled by provider */
      }
    },
    [update],
  )

  useEffect(() => {
    const subscription = watch(debouncedWatcher)
    return () => subscription.unsubscribe()
  }, [watch, debouncedWatcher])

  const taxId = watch('customer_tax_id')
  const addTaxID = useCallback(async () => {
    if (!taxId) {
      return
    }
    clearErrors('customer_tax_id')
    try {
      await update({ customer_tax_id: taxId })
    } catch {
      /* API errors handled by provider */
    }
  }, [update, taxId, clearErrors])
  const clearTaxId = useCallback(async () => {
    clearErrors('customer_tax_id')
    try {
      await update({ customer_tax_id: null })
      resetField('customer_tax_id')
    } catch {
      /* API errors handled by provider */
    }
  }, [update, clearErrors, resetField])

  const onSubmit = async (data: schemas['CheckoutUpdatePublic']) => {
    // Don't send undefined/null data in the custom field object to please the SDK
    const cleanedFieldData = data.custom_field_data
      ? Object.fromEntries(
          Object.entries(data.custom_field_data).filter(
            ([, value]) => value !== undefined && value !== null,
          ),
        )
      : {}

    if (
      data.discount_code === '' ||
      // Avoid overwriting a programmatically set discount without a code.
      (!data.discount_code && isDiscountWithoutCode)
    ) {
      delete data.discount_code
    }

    await confirm({
      ...data,
      locale: localeProp,
      custom_field_data: cleanedFieldData,
    })
  }

  const validTaxID = !!checkout.customer_tax_id

  // Make sure to clear the discount code field if the discount is removed by the API
  useEffect(() => {
    if (!checkout.discount) {
      resetField('discount_code')
    }
  }, [checkout, resetField])

  const checkoutLabel = useMemo(() => {
    if (checkout.active_trial_interval) {
      return t('checkout.cta.startTrial')
    }

    if (checkout.is_payment_form_required) {
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
                name="customer_email"
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
                        disabled={checkout.customer_id !== null}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {children}

              {checkout.is_payment_form_required && !isWalletPayment && (
                <FormField
                  control={control}
                  name="customer_name"
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

              {(checkout.is_payment_form_required ||
                checkout.require_billing_address) && (
                <>
                  <FormItem>
                    <FormLabel>
                      {t('checkout.form.billingAddress.label')}
                    </FormLabel>
                    {isDisplayedField(
                      checkout.billing_address_fields.line1,
                    ) && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customer_billing_address.line1"
                          rules={{
                            required: isRequiredField(
                              checkout.billing_address_fields.line1,
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
                    {isDisplayedField(
                      checkout.billing_address_fields.line2,
                    ) && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customer_billing_address.line2"
                          rules={{
                            required: isRequiredField(
                              checkout.billing_address_fields.line2,
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
                      checkout.billing_address_fields.postal_code,
                    ) ||
                      isDisplayedField(
                        checkout.billing_address_fields.city,
                      )) && (
                      <div className="grid grid-cols-2 gap-x-2">
                        {isDisplayedField(
                          checkout.billing_address_fields.postal_code,
                        ) && (
                          <FormControl>
                            <FormField
                              control={control}
                              name="customer_billing_address.postal_code"
                              rules={{
                                required: isRequiredField(
                                  checkout.billing_address_fields.postal_code,
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
                          checkout.billing_address_fields.city,
                        ) && (
                          <FormControl>
                            <FormField
                              control={control}
                              name="customer_billing_address.city"
                              rules={{
                                required: isRequiredField(
                                  checkout.billing_address_fields.city,
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
                    {isDisplayedField(
                      checkout.billing_address_fields.state,
                    ) && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customer_billing_address.state"
                          rules={{
                            required: isRequiredField(
                              checkout.billing_address_fields.state,
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
                      checkout.billing_address_fields.country,
                    ) && (
                      <FormControl>
                        <FormField
                          control={control}
                          name="customer_billing_address.country"
                          rules={{
                            required: isRequiredField(
                              checkout.billing_address_fields.country,
                            )
                              ? t('checkout.form.fieldRequired')
                              : false,
                          }}
                          render={({ field }) => (
                            <>
                              <CountryPicker
                                allowedCountries={
                                  enums.addressInputCountryValues
                                }
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
                    {errors.customer_billing_address?.message && (
                      <p className="text-destructive-foreground text-sm">
                        {errors.customer_billing_address.message}
                      </p>
                    )}
                  </FormItem>

                  <FormField
                    control={control}
                    name="is_business_customer"
                    render={({ field }) => (
                      <FormItem className="-mt-4">
                        <div className="flex flex-row items-center space-y-0 space-x-2">
                          <FormControl>
                            <Checkbox
                              className={cn(
                                'dark:border-polar-600 cursor-pointer border-gray-300',
                                field.value ? 'border-primary' : '',
                              )}
                              checked={field.value ? field.value : false}
                              onCheckedChange={(checked) => {
                                if (isUpdatePending) return
                                field.onChange(checked)
                                updateBusinessCustomer(!!checked)
                              }}
                            />
                          </FormControl>
                          <FormLabel className="dark:text-polar-400 cursor-pointer font-normal">
                            {t('checkout.form.purchasingAsBusiness')}
                          </FormLabel>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isBusinessCustomer && (
                    <div className="dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 p-4">
                      <span className="text-sm font-medium">
                        {t('checkout.form.billingDetails')}
                      </span>
                      <FormField
                        control={control}
                        name="customer_billing_name"
                        rules={{
                          required: t('checkout.form.fieldRequired'),
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="text"
                                autoComplete="billing organization"
                                placeholder={t('checkout.form.businessName')}
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="customer_tax_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="text"
                                  autoComplete="off"
                                  placeholder={`${t('checkout.form.taxId')} (${t('checkout.form.optional')})`}
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
                    </div>
                  )}
                </>
              )}
              {checkout.attached_custom_fields &&
                checkout.attached_custom_fields.map(
                  ({ custom_field, required }) => (
                    <FormField
                      key={custom_field.id}
                      control={control}
                      name={`custom_field_data.${custom_field.slug}`}
                      rules={{
                        required: required
                          ? t('checkout.form.fieldRequired')
                          : undefined,
                      }}
                      render={({ field }) => (
                        <CustomFieldInput
                          customField={custom_field}
                          required={required}
                          field={field}
                        />
                      )}
                    />
                  ),
                )}
            </div>
            {beforeSubmit}
            <div className="flex w-full flex-col items-center justify-center gap-y-2">
              <Button
                type="submit"
                size="lg"
                wrapperClassNames="text-base"
                className="w-full"
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
        <div>
          <p className="dark:text-polar-500 text-center text-xs text-gray-500">
            {checkout.is_payment_form_required
              ? checkout.active_trial_interval
                ? t('checkout.footer.mandateSubscriptionTrial', {
                    buttonLabel: checkoutLabel,
                  })
                : interval
                  ? t('checkout.footer.mandateSubscription', {
                      buttonLabel: checkoutLabel,
                    })
                  : t('checkout.footer.mandateOneTime', {
                      buttonLabel: checkoutLabel,
                    })
              : t('checkout.footer.merchantOfRecord')}
          </p>
        </div>
      </div>
      <a
        href="https://polar.sh?utm_source=checkout"
        className="dark:text-polar-600 flex w-full flex-row items-center justify-center gap-x-3 text-sm text-gray-400"
        target="_blank"
        rel="noreferrer"
      >
        <span>{t('checkout.footer.poweredBy')}</span>
        <PolarLogo className="h-5" />
      </a>
    </div>
  )
}

interface CheckoutFormProps {
  form: UseFormReturn<schemas['CheckoutUpdatePublic']>
  checkout: schemas['CheckoutPublic']
  update: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<schemas['CheckoutPublic']>
  confirm: (
    data: schemas['CheckoutConfirmStripe'],
    stripe: Stripe | null,
    elements: StripeElements | null,
  ) => Promise<schemas['CheckoutPublicConfirmed']>
  loading: boolean
  loadingLabel: string | undefined
  disabled?: boolean
  isUpdatePending?: boolean
  theme?: 'light' | 'dark'
  themePreset: ThemingPresetProps
  locale?: AcceptedLocale
  beforeSubmit?: React.ReactNode
}

const StripeCheckoutForm = (props: CheckoutFormProps) => {
  const { checkout, confirm, themePreset: themePresetProps, locale } = props
  const {
    payment_processor_metadata: { publishable_key },
  } = checkout
  const stripePromise = useMemo(
    () => loadStripe(publishable_key),
    [publishable_key],
  )

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    string | undefined
  >()
  const isWalletPayment = selectedPaymentMethod
    ? WALLET_PAYMENT_METHODS.includes(selectedPaymentMethod)
    : false

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
        currency: checkout.currency,
      }
    } else if (checkout.is_payment_required && checkout.total_amount) {
      return {
        mode: 'payment',
        paymentMethodCreation: 'manual',
        amount: checkout.total_amount,
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
        locale: locale ? convertLocaleToStripeElementLocale(locale) : undefined,
        customerSessionClientSecret: (
          checkout.payment_processor_metadata as {
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
            isWalletPayment={isWalletPayment}
          >
            {checkout.is_payment_form_required && (
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
                  terms: {
                    applePay: 'never',
                    auBecsDebit: 'never',
                    bancontact: 'never',
                    card: 'never',
                    cashapp: 'never',
                    googlePay: 'never',
                    ideal: 'never',
                    paypal: 'never',
                    sepaDebit: 'never',
                    sofort: 'never',
                    usBankAccount: 'never',
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
        customer_session_token: '',
      })}
      update={async () => checkout}
      disabled={disabled ?? true}
    />
  )
}

const CheckoutForm = (props: CheckoutFormProps) => {
  const {
    checkout: { payment_processor },
  } = props

  if (payment_processor === 'stripe') {
    return <StripeCheckoutForm {...props} />
  }
  return <DummyCheckoutForm {...props} />
}

export default CheckoutForm
