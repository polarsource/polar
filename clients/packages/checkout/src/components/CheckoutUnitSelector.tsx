'use client'

import { type schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getUnitPrice, type ProductCheckoutPublic } from '../guards'
import { ErrorResponse } from '../providers/CheckoutProvider'
import { capitalize } from '../utils/string'
import { getUnitLabels } from '../utils/units'
import MeteredPricesDisplay from './MeteredPricesDisplay'
import { UnitQuantityControl } from './UnitQuantityControl'

export interface CheckoutUnitSelectorProps {
  checkout: ProductCheckoutPublic
  update: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<schemas['CheckoutPublic']>
  locale?: AcceptedLocale
  compact?: boolean
}

const CheckoutUnitSelector = ({
  checkout,
  update,
  locale = DEFAULT_LOCALE,
  compact = false,
}: CheckoutUnitSelectorProps) => {
  const t = useTranslations(locale)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoCorrectAttempted = useRef(false)

  const getErrorMessage = useCallback(
    (error: ErrorResponse<'checkouts:client_update'> | null): string => {
      if (error && error.error === 'PolarRequestValidationError') {
        return error.detail[0]?.msg
      }

      return t('checkout.pricing.units.updateFailed')
    },
    [t],
  )

  const unitPrice = getUnitPrice(checkout)
  const isUnitBased = unitPrice !== null

  const unitLabels = getUnitLabels(unitPrice, locale)
  const tierMinimumUnits = unitPrice?.minimum_units ?? 1
  const tierMaximumUnits = unitPrice?.maximum_units ?? null
  const minimumUnits = checkout.min_units ?? tierMinimumUnits
  const maximumUnits = checkout.max_units ?? tierMaximumUnits
  const hasMaximumLimit = maximumUnits !== null
  const isFixedUnits = hasMaximumLimit && minimumUnits === maximumUnits

  // Display units clamped to at least the minimum
  const displayUnits = Math.max(checkout.units || minimumUnits, minimumUnits)
  const needsUnitCorrection =
    checkout.units !== null &&
    checkout.units !== undefined &&
    checkout.units < minimumUnits

  const netAmount = checkout.net_amount || 0
  const currency = checkout.currency ?? 'usd'
  // Auto-correct unit count if it's below the minimum (only attempt once)
  useEffect(() => {
    if (
      isUnitBased &&
      needsUnitCorrection &&
      !isFixedUnits &&
      !isUpdating &&
      !autoCorrectAttempted.current
    ) {
      autoCorrectAttempted.current = true

      update({
        units: minimumUnits,
      }).catch((err) => {
        setError(getErrorMessage(err))
      })
    }
  }, [
    isUnitBased,
    needsUnitCorrection,
    isFixedUnits,
    minimumUnits,
    isUpdating,
    update,
    getErrorMessage,
  ])

  if (!isUnitBased) {
    return null
  }

  const handleUpdateUnits = async (newUnits: number) => {
    if (newUnits < minimumUnits || isUpdating) return
    if (hasMaximumLimit && newUnits > maximumUnits) return

    setIsUpdating(true)
    setError(null)

    await update({
      units: newUnits,
    })
      .catch((error) => {
        setError(getErrorMessage(error))
      })
      .finally(() => {
        setIsUpdating(false)
      })
  }

  const getUnitLimitText = () => {
    if (minimumUnits > 1 && hasMaximumLimit) {
      return t('checkout.pricing.units.range', {
        min: minimumUnits,
        max: maximumUnits,
        unitLabelPlural: unitLabels.unitLabelPlural,
      })
    } else if (minimumUnits > 1) {
      return t('checkout.pricing.units.minimum', {
        min: minimumUnits,
        unitLabelPlural: unitLabels.unitLabelPlural,
      })
    } else if (hasMaximumLimit) {
      return t('checkout.pricing.units.maximum', {
        max: maximumUnits,
        unitLabelPlural: unitLabels.unitLabelPlural,
      })
    }
    return null
  }

  const unitLimitText = getUnitLimitText()

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium dark:text-white">
              {t('checkout.pricing.units.label', {
                unitLabelPlural: capitalize(unitLabels.unitLabelPlural),
              })}
            </span>
          </div>
          {isFixedUnits ? (
            <span className="text-sm font-medium dark:text-white">
              {displayUnits}
            </span>
          ) : (
            <UnitQuantityControl
              units={displayUnits}
              minimumUnits={minimumUnits}
              maximumUnits={maximumUnits}
              isUpdating={isUpdating}
              onUpdate={handleUpdateUnits}
              compact
            />
          )}
        </div>
        {!isFixedUnits && unitLimitText && (
          <p className="dark:text-polar-400 text-xs text-gray-500">
            {unitLimitText}
          </p>
        )}
        {error && (
          <p className="text-destructive-foreground text-sm">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1
          className="text-3xl font-[350] text-gray-900 dark:text-white"
          data-testid="headline-price"
        >
          {formatCurrency('compact', locale)(netAmount, currency)}
        </h1>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-lg">
          {t('checkout.pricing.units.numberOfUnits', {
            unitLabelPlural: unitLabels.unitLabelPlural,
          })}
        </label>
        {isFixedUnits ? (
          <span className="min-w-[3.5rem] text-2xl font-[350] text-gray-900 dark:text-white">
            {displayUnits}
          </span>
        ) : (
          <UnitQuantityControl
            units={displayUnits}
            minimumUnits={minimumUnits}
            maximumUnits={maximumUnits}
            isUpdating={isUpdating}
            onUpdate={handleUpdateUnits}
          />
        )}
        {!isFixedUnits && unitLimitText && (
          <p className="dark:text-polar-400 text-xs text-gray-500">
            {unitLimitText}
          </p>
        )}
        {error && (
          <p className="text-destructive-foreground text-sm">{error}</p>
        )}
      </div>

      <MeteredPricesDisplay checkout={checkout} locale={locale} />
    </div>
  )
}

export default CheckoutUnitSelector
