'use client'

import { TrialConfigurationForm } from '@/components/TrialConfiguration/TrialConfigurationForm'
import { isLegacyRecurringPrice, isMeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Label } from '@polar-sh/ui/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { Section } from '../../Layout/Section'
import { CurrencyTabs } from './Pricing/CurrencyTabs'
import { ProductPriceItem } from './Pricing/ProductPriceItem'
import {
  getActiveCurrencies,
  groupPricesByCurrency,
  hasPriceCurrency,
  ProductPrice,
  ProductPriceCreate,
} from './Pricing/utils'
import { ProductFormType } from './ProductForm'

export interface ProductPricingSectionProps {
  organization: schemas['Organization']
  className?: string
  update?: boolean
  compact?: boolean
}

export const ProductPricingSection = ({
  organization,
  className,
  update,
  compact,
}: ProductPricingSectionProps) => {
  const { control, setValue, watch, getValues } =
    useFormContext<ProductFormType>()

  const pricesFieldArray = useFieldArray({
    control,
    name: 'prices',
  })

  const { fields: prices, append, remove, replace } = pricesFieldArray

  const defaultCurrency = organization.default_presentment_currency

  const [selectedCurrency, setSelectedCurrency] =
    useState<string>(defaultCurrency)

  const activeCurrencies = useMemo(() => {
    const currencies = getActiveCurrencies(prices as ProductFormType['prices'])
    if (!currencies.includes(defaultCurrency)) {
      return [defaultCurrency, ...currencies]
    }
    return [defaultCurrency, ...currencies.filter((c) => c !== defaultCurrency)]
  }, [prices, defaultCurrency])

  const validatedSelectedCurrency = activeCurrencies.includes(selectedCurrency)
    ? selectedCurrency
    : defaultCurrency

  const isLegacyRecurringProduct = useMemo(
    () => (prices as ProductPrice[]).some(isLegacyRecurringPrice),
    [prices],
  )

  const recurringInterval = watch('recurring_interval')
  const recurringIntervalCount = watch('recurring_interval_count')

  useEffect(() => {
    if (recurringInterval !== null) {
      if (!recurringIntervalCount) {
        setValue('recurring_interval_count', 1)
      }
      return
    }

    setValue('recurring_interval_count', null)
    const currentPrices = getValues('prices')
    if (!currentPrices) return
    const filteredPrices = currentPrices.filter(
      (price) => !isMeteredPrice(price as ProductPrice),
    )
    if (filteredPrices.length !== currentPrices.length) {
      replace(filteredPrices)
    }
  }, [recurringInterval, recurringIntervalCount, setValue, getValues, replace])

  const [productType, setProductType] = useState<'one_time' | 'recurring'>(
    recurringInterval === null ? 'one_time' : 'recurring',
  )

  useEffect(() => {
    if (productType === 'one_time') {
      setValue('recurring_interval', null)
    } else {
      if (recurringInterval === null) {
        setValue('recurring_interval', 'month')
      }

      if (!recurringIntervalCount) {
        setValue('recurring_interval_count', 1)
      }
    }
  }, [productType, recurringInterval, recurringIntervalCount, setValue])

  const pricesByCurrency = useMemo(
    () => groupPricesByCurrency(prices as ProductFormType['prices']),
    [prices],
  )

  const pricesForSelectedCurrency = useMemo(
    () => pricesByCurrency.get(validatedSelectedCurrency) || [],
    [pricesByCurrency, validatedSelectedCurrency],
  )

  const handleAmountTypeChange = useCallback(
    (
      changedIndex: number,
      newAmountType: ProductPriceCreate['amount_type'],
    ) => {
      const currentPrices = getValues('prices')
      if (!currentPrices) return
      const changedPrice = currentPrices[changedIndex]
      if (!hasPriceCurrency(changedPrice)) return
      const changedCurrency = changedPrice.price_currency

      const pricesByCurr = groupPricesByCurrency(currentPrices)
      const changedCurrencyPrices = pricesByCurr.get(changedCurrency) || []
      const positionInCurrency = changedCurrencyPrices.findIndex(
        (p) => p.index === changedIndex,
      )

      const createPriceForCurrency = (currency: string): ProductPriceCreate => {
        const base = {
          price_currency: currency as schemas['PresentmentCurrency'],
        }
        if (newAmountType === 'fixed') {
          return { ...base, amount_type: 'fixed', price_amount: 0 }
        } else if (newAmountType === 'custom') {
          return { ...base, amount_type: 'custom', minimum_amount: 0 }
        } else if (newAmountType === 'free') {
          return { ...base, amount_type: 'free' }
        } else if (newAmountType === 'seat_based') {
          return {
            ...base,
            amount_type: 'seat_based',
            seat_tiers: {
              tiers: [{ min_seats: 1, max_seats: null, price_per_seat: 0 }],
            },
          }
        } else if (newAmountType === 'metered_unit') {
          return {
            ...base,
            amount_type: 'metered_unit',
            unit_amount: 0,
            meter_id: '',
          }
        }
        return { ...base, amount_type: 'free' }
      }

      setValue(
        `prices.${changedIndex}`,
        createPriceForCurrency(changedCurrency),
      )
      setValue(`prices.${changedIndex}.id`, '')

      pricesByCurr.forEach((currencyPrices, currency) => {
        if (currency === changedCurrency) return
        if (positionInCurrency < currencyPrices.length) {
          const correspondingPrice = currencyPrices[positionInCurrency]
          setValue(
            `prices.${correspondingPrice.index}`,
            createPriceForCurrency(currency),
          )
          setValue(`prices.${correspondingPrice.index}.id`, '')
        }
      })
    },
    [getValues, setValue],
  )

  const handleAddCurrency = useCallback(
    (newCurrency: string) => {
      const currentPrices = getValues('prices')
      if (!currentPrices) return
      const defaultCurrencyPrices = currentPrices.filter(
        (p) => hasPriceCurrency(p) && p.price_currency === defaultCurrency,
      )

      defaultCurrencyPrices.forEach((price) => {
        if (!('amount_type' in price)) return

        let newPrice: ProductPriceCreate
        const baseCurrency = {
          price_currency: newCurrency as schemas['PresentmentCurrency'],
        }

        if (price.amount_type === 'fixed') {
          newPrice = { ...baseCurrency, amount_type: 'fixed', price_amount: 0 }
        } else if (price.amount_type === 'custom') {
          newPrice = {
            ...baseCurrency,
            amount_type: 'custom',
            minimum_amount: 0,
          }
        } else if (price.amount_type === 'free') {
          newPrice = { ...baseCurrency, amount_type: 'free' }
        } else if (price.amount_type === 'seat_based') {
          const sourceTiers =
            'seat_tiers' in price && price.seat_tiers?.tiers
              ? price.seat_tiers.tiers
              : []
          const seatTiers = sourceTiers.map((t) => ({
            min_seats: t.min_seats,
            max_seats: t.max_seats ?? null,
            price_per_seat: 0,
          }))
          if (seatTiers.length === 0) {
            seatTiers.push({ min_seats: 1, max_seats: null, price_per_seat: 0 })
          }
          newPrice = {
            ...baseCurrency,
            amount_type: 'seat_based',
            seat_tiers: { tiers: seatTiers },
          }
        } else if (price.amount_type === 'metered_unit') {
          const meterId = 'meter_id' in price ? price.meter_id : ''
          newPrice = {
            ...baseCurrency,
            amount_type: 'metered_unit',
            unit_amount: 0,
            meter_id: meterId,
          }
        } else {
          newPrice = { ...baseCurrency, amount_type: 'free' }
        }

        append(newPrice)
      })

      setSelectedCurrency(newCurrency)
    },
    [getValues, defaultCurrency, append],
  )

  const handleRemoveCurrency = useCallback(
    (currencyToRemove: string) => {
      if (currencyToRemove === defaultCurrency) return

      const currentPrices = getValues('prices')
      if (!currentPrices) return
      const indicesToRemove = currentPrices
        .map((p, i) =>
          hasPriceCurrency(p) && p.price_currency === currencyToRemove ? i : -1,
        )
        .filter((i) => i !== -1)
        .reverse()

      indicesToRemove.forEach((i) => remove(i))
      setSelectedCurrency(defaultCurrency)
    },
    [getValues, defaultCurrency, remove],
  )

  const handleAddMeteredPrice = useCallback(() => {
    activeCurrencies.forEach((currency) => {
      append({
        amount_type: 'metered_unit',
        price_currency: currency as schemas['PresentmentCurrency'],
        meter_id: '',
        unit_amount: 0,
      })
    })
  }, [activeCurrencies, append])

  const handleRemovePrice = useCallback(
    (indexToRemove: number) => {
      const currentPrices = getValues('prices')
      if (!currentPrices) return
      const priceToRemove = currentPrices[indexToRemove]

      if (isMeteredPrice(priceToRemove as ProductPrice)) {
        const meterId =
          'meter_id' in priceToRemove ? priceToRemove.meter_id : undefined

        const indicesToRemove = currentPrices
          .map((p, i) =>
            'amount_type' in p &&
            p.amount_type === 'metered_unit' &&
            'meter_id' in p &&
            p.meter_id === meterId
              ? i
              : -1,
          )
          .filter((i) => i !== -1)
          .reverse()

        indicesToRemove.forEach((i) => remove(i))
      } else {
        remove(indexToRemove)
      }
    },
    [getValues, remove],
  )

  if (isLegacyRecurringProduct) {
    return (
      <Section
        title="Pricing"
        description="Set your billing cycle and pricing model"
        className={className}
        compact={compact}
      >
        <div className="prose dark:bg-polar-700 dark:text-polar-500 rounded-2xl bg-gray-100 p-6 text-sm text-gray-500">
          <p>
            This product uses a deprecated pricing model with both a monthly and
            yearly pricing.
          </p>
          <p>
            To better support future pricing model, the billing cycle is now set
            at the product level, meaning you need to create a separate product
            for each billing cycle.
          </p>
          <p>
            If you want to make any changes to the pricing model, you need to
            create a new product. Feel free to reach out to our support team if
            you need assistance.
          </p>
        </div>
      </Section>
    )
  }

  return (
    <Section
      title="Pricing"
      description="Set your billing cycle and pricing model"
      className={className}
      compact={compact}
    >
      <div className="dark:divide-polar-700 flex w-full flex-col divide-y divide-gray-200">
        <div className="@container flex flex-col gap-y-6 py-6">
          <RadioGroup
            value={productType}
            onValueChange={(v) => setProductType(v as 'one_time' | 'recurring')}
            className={twMerge(
              'grid-cols-1 gap-3',
              compact ? 'grid-cols-1' : '@md:grid-cols-2',
            )}
          >
            {['one_time', 'recurring'].map((option) => (
              <Label
                key={option}
                htmlFor={`price-type-${option}`}
                className={`flex flex-col gap-3 rounded-2xl border p-4 font-normal transition-colors not-aria-disabled:cursor-pointer ${
                  productType === option
                    ? 'dark:bg-polar-800 bg-gray-50'
                    : 'dark:border-polar-700 dark:not-aria-disabled:hover:border-polar-700 dark:text-polar-500 dark:not-aria-disabled:hover:bg-polar-700 dark:bg-polar-900 border-gray-100 text-gray-500 not-aria-disabled:hover:border-gray-200'
                }`}
                aria-disabled={update}
              >
                <div>
                  <div className="flex items-center gap-2.5 font-medium">
                    <RadioGroupItem
                      value={option}
                      id={`price-type-${option}`}
                      disabled={update}
                    />
                    {option === 'one_time'
                      ? 'One-time purchase'
                      : 'Recurring subscription'}
                  </div>
                </div>
              </Label>
            ))}
          </RadioGroup>
          {productType === 'recurring' && (
            <div className="flex items-start gap-3 text-sm">
              <span className="flex h-10 items-center">Every</span>
              <FormField
                control={control}
                name="recurring_interval_count"
                rules={{
                  required: 'This field is required when billing cycle is set',
                  min: {
                    value: 1,
                    message: 'Interval count must be at least 1',
                  },
                  max: {
                    value: 999,
                    message: 'Interval count cannot exceed 999',
                  },
                }}
                render={({ field }) => {
                  return (
                    <Input
                      type="text"
                      min="1"
                      max="999"
                      pattern="\d*"
                      defaultValue={field.value || 1}
                      onChange={(e) => {
                        const parsedValue = parseInt(e.target.value)
                        field.onChange(isNaN(parsedValue) ? '' : parsedValue)
                      }}
                      disabled={update}
                      className="min-w-12"
                    />
                  )
                }}
              />
              <FormField
                control={control}
                name="recurring_interval"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormControl>
                        <div>
                          <Select
                            onValueChange={(value) => field.onChange(value)}
                            defaultValue={field.value ?? 'month'}
                            disabled={update}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a billing cycle" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day">
                                day
                                {recurringIntervalCount !== 1 ? 's' : ''}
                              </SelectItem>
                              <SelectItem value="week">
                                week
                                {recurringIntervalCount !== 1 ? 's' : ''}
                              </SelectItem>
                              <SelectItem value="month">
                                month
                                {recurringIntervalCount !== 1 ? 's' : ''}
                              </SelectItem>
                              <SelectItem value="year">
                                year
                                {recurringIntervalCount !== 1 ? 's' : ''}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            </div>
          )}
        </div>

        <CurrencyTabs
          activeCurrencies={activeCurrencies}
          selectedCurrency={validatedSelectedCurrency}
          onSelectCurrency={setSelectedCurrency}
          onAddCurrency={handleAddCurrency}
          onRemoveCurrency={handleRemoveCurrency}
          defaultCurrency={defaultCurrency}
        />

        <div className="flex flex-col gap-y-6 py-6">
          <div className="flex flex-row items-center justify-between">
            <h3>Price Type</h3>
            {recurringInterval !== null && (
              <Button
                className="self-start"
                variant="secondary"
                size="sm"
                onClick={handleAddMeteredPrice}
              >
                Add metered price
              </Button>
            )}
          </div>
          {pricesForSelectedCurrency.map(({ price, index }) => (
            <ProductPriceItem
              organization={organization}
              index={index}
              currency={validatedSelectedCurrency}
              onRemove={handleRemovePrice}
              onAmountTypeChange={handleAmountTypeChange}
              canRemove={
                isMeteredPrice(price as ProductPrice) &&
                (pricesForSelectedCurrency.filter((p) =>
                  isMeteredPrice(p.price as ProductPrice),
                ).length > 1 ||
                  pricesForSelectedCurrency.filter(
                    (p) => !isMeteredPrice(p.price as ProductPrice),
                  ).length >= 1)
              }
              key={`${selectedCurrency}-${index}`}
            />
          ))}
        </div>

        {recurringInterval && (
          <div className="flex flex-col py-6">
            <TrialConfigurationForm />
          </div>
        )}

        {update && recurringInterval && (
          <div className="flex flex-col py-6">
            <ShadowBox className="dark:bg-polar-800 flex flex-col gap-2 rounded-2xl! border-none! p-4">
              <h3 className="text-sm font-medium">Updating pricing model</h3>
              <p className="dark:text-polar-500 text-gray-5 00 text-sm">
                Changing pricing model on subscription products will only affect
                new customers. Current customers will keep their original
                pricing model.
              </p>
            </ShadowBox>
          </div>
        )}
      </div>
    </Section>
  )
}
