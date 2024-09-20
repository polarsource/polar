'use client'

import {
  Organization,
  Product,
  ProductPriceRecurring,
  ProductPriceType,
  SubscriptionRecurringInterval,
} from '@polar-sh/sdk'
import Link from 'next/link'
import Button, { ButtonProps } from 'polarkit/components/ui/atoms/button'
import React, { useMemo } from 'react'

const buttonClasses =
  'grow transition-colors dark:hover:border-[--var-dark-border-color] dark:hover:bg-[--var-dark-border-color] dark:hover:text-[--var-dark-fg-color]'

interface CheckoutButtonProps {
  product: Product
  recurringInterval?: SubscriptionRecurringInterval
  organization: Organization
  checkoutPath: string
  variant?: ButtonProps['variant']
}

const CheckoutButton: React.FC<
  React.PropsWithChildren<CheckoutButtonProps>
> = ({ product, recurringInterval, checkoutPath, variant, children }) => {
  const price = useMemo(() => {
    if (product.is_recurring && recurringInterval) {
      return product.prices.find(
        (price) =>
          price.type === ProductPriceType.RECURRING &&
          price.recurring_interval === recurringInterval,
      ) as ProductPriceRecurring
    }
    return product.prices[0]
  }, [product, recurringInterval])

  return (
    <Link className="w-full" href={`${checkoutPath}?price=${price.id}`}>
      <Button
        className={variant === 'outline' ? buttonClasses : ''}
        fullWidth
        variant={variant}
        size="lg"
      >
        {children}
      </Button>
    </Link>
  )
}

export default CheckoutButton
