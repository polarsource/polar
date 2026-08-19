'use client'

import type { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import type { ProductCheckoutPublic } from '../guards'
import { getUnitLabels } from '../utils/units'
import AmountLabel from './AmountLabel'
import ProductPriceLabel from './ProductPriceLabel'

export interface CheckoutProductSwitcherItemPriceProps {
  isSelected: boolean
  product: ProductCheckoutPublic['product']
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice']
  checkout: ProductCheckoutPublic
  locale?: AcceptedLocale
}

export const CheckoutProductSwitcherItemPrice = ({
  isSelected,
  product,
  price,
  checkout,
  locale,
}: CheckoutProductSwitcherItemPriceProps) => {
  const productPrices = (checkout.prices[product.id] ?? []).filter(
    (productPrice) => productPrice.price_currency === checkout.currency,
  )
  const fixedPrice = productPrices.find(
    (productPrice): productPrice is schemas['ProductPriceFixed'] =>
      productPrice.amount_type === 'fixed',
  )
  const seatPrice = productPrices.find(
    (productPrice): productPrice is schemas['ProductPriceSeatBased'] =>
      productPrice.amount_type === 'seat_based',
  )
  const unitPrice = productPrices.find(
    (productPrice): productPrice is schemas['ProductPriceUnitBased'] =>
      productPrice.amount_type === 'unit_based',
  )

  if (fixedPrice && seatPrice) {
    return (
      <FixedSeatPrice
        fixedPrice={fixedPrice}
        seatPrice={seatPrice}
        product={product}
        locale={locale}
      />
    )
  }

  if (fixedPrice && unitPrice) {
    return (
      <FixedUnitPrice
        fixedPrice={fixedPrice}
        unitPrice={unitPrice}
        product={product}
        locale={locale}
      />
    )
  }

  if (price.amount_type === 'unit_based') {
    if (isSelected) {
      return (
        <AmountLabel
          amount={checkout.net_amount || 0}
          currency={price.price_currency}
          interval={product.recurring_interval}
          intervalCount={product.recurring_interval_count}
          mode="standard"
          locale={locale}
        />
      )
    }

    const minimumAmount =
      Number(price.tiers.tiers[0]?.unit_amount ?? 0) *
      (price.minimum_units ?? 1)

    return (
      <FromPrice
        amount={minimumAmount}
        currency={price.price_currency}
        interval={product.recurring_interval}
        intervalCount={product.recurring_interval_count}
        locale={locale}
      />
    )
  }

  if (price.amount_type === 'seat_based') {
    if (isSelected) {
      return (
        <AmountLabel
          amount={checkout.net_amount || 0}
          currency={price.price_currency}
          interval={product.recurring_interval}
          intervalCount={product.recurring_interval_count}
          mode="standard"
          locale={locale}
        />
      )
    }

    const minimumAmount =
      (price.seat_tiers?.tiers?.[0]?.price_per_seat ?? 0) *
      (price.seat_tiers?.minimum_seats ?? 1)

    return (
      <FromPrice
        amount={minimumAmount}
        currency={price.price_currency}
        interval={product.recurring_interval}
        intervalCount={product.recurring_interval_count}
        locale={locale}
      />
    )
  }

  return (
    <ProductPriceLabel
      product={product}
      price={price}
      locale={locale}
      mode="standard"
    />
  )
}

const FixedSeatPrice = ({
  fixedPrice,
  seatPrice,
  product,
  locale,
}: {
  fixedPrice: schemas['ProductPriceFixed']
  seatPrice: schemas['ProductPriceSeatBased']
  product: ProductCheckoutPublic['product']
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale ?? DEFAULT_LOCALE)
  const sortedTiers = (seatPrice.seat_tiers?.tiers ?? []).toSorted(
    (a, b) => a.min_seats - b.min_seats,
  )
  const basePricePerSeat = sortedTiers[0]?.price_per_seat ?? 0
  return (
    <span className="flex flex-wrap items-baseline justify-end gap-x-1">
      <AmountLabel
        amount={fixedPrice.price_amount}
        currency={fixedPrice.price_currency}
        interval={product.recurring_interval}
        intervalCount={product.recurring_interval_count}
        mode="standard"
        locale={locale}
      />
      <span>+</span>
      <AmountLabel
        amount={basePricePerSeat}
        currency={seatPrice.price_currency}
        mode="standard"
        locale={locale}
      />
      <span>{t('checkout.pricing.perSeat')}</span>
    </span>
  )
}

const FixedUnitPrice = ({
  fixedPrice,
  unitPrice,
  product,
  locale,
}: {
  fixedPrice: schemas['ProductPriceFixed']
  unitPrice: schemas['ProductPriceUnitBased']
  product: ProductCheckoutPublic['product']
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale ?? DEFAULT_LOCALE)
  const basePricePerUnit = Number(unitPrice.tiers.tiers[0]?.unit_amount ?? 0)
  const { unitLabel } = getUnitLabels(unitPrice)
  return (
    <span className="flex flex-wrap items-baseline justify-end gap-x-1">
      <AmountLabel
        amount={fixedPrice.price_amount}
        currency={fixedPrice.price_currency}
        interval={product.recurring_interval}
        intervalCount={product.recurring_interval_count}
        mode="standard"
        locale={locale}
      />
      <span>+</span>
      <AmountLabel
        amount={basePricePerUnit}
        currency={unitPrice.price_currency}
        mode="standard"
        locale={locale}
      />
      <span>{t('checkout.pricing.perUnit', { unitLabel })}</span>
    </span>
  )
}

const FromPrice = ({
  amount,
  currency,
  interval,
  intervalCount,
  locale,
}: {
  amount: number
  currency: string
  interval?: schemas['RecurringInterval'] | null
  intervalCount?: number | null
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale ?? DEFAULT_LOCALE)
  return (
    <span className="flex items-baseline">
      {t('checkout.productSwitcher.fromPrefix')}&nbsp;
      <AmountLabel
        amount={amount}
        currency={currency}
        interval={interval}
        intervalCount={intervalCount}
        mode="standard"
        locale={locale}
      />
    </span>
  )
}
