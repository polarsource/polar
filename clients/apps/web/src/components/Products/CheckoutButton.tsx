'use client'

import { useAuth } from '@/hooks'
import { useUserSubscriptions } from '@/hooks/queries'
import { api } from '@/utils/api'
import {
  Organization,
  Product,
  ProductPrice,
  ProductPriceRecurring,
  ProductPriceType,
  SubscriptionRecurringInterval,
  UserRead,
} from '@polar-sh/sdk'
import Link from 'next/link'
import Button, { ButtonProps } from 'polarkit/components/ui/atoms/button'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import React, { useCallback, useMemo, useState } from 'react'
import { ConfirmModal } from '../Modal/ConfirmModal'

const buttonClasses =
  'grow transition-colors dark:hover:border-[--var-dark-border-color] dark:hover:bg-[--var-dark-border-color] dark:hover:text-[--var-dark-fg-color]'

interface AnonymousCheckoutButtonProps {
  price: ProductPrice
  checkoutPath: string
  variant?: ButtonProps['variant']
}

const AnonymousCheckoutButton: React.FC<
  React.PropsWithChildren<AnonymousCheckoutButtonProps>
> = ({ price, checkoutPath, variant = 'outline', children }) => {
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

interface AuthenticatedCheckoutButtonProps {
  user: UserRead
  product: Product
  price: ProductPrice
  organization: Organization
  checkoutPath: string
  variant?: ButtonProps['variant']
}

const AuthenticatedCheckoutButton: React.FC<
  React.PropsWithChildren<AuthenticatedCheckoutButtonProps>
> = ({
  user,
  product,
  price,
  organization,
  checkoutPath,
  variant = 'outline',
  children,
}) => {
  return price.type === ProductPriceType.RECURRING ? (
    <AuthenticatedRecurringCheckoutButton
      user={user}
      product={product}
      price={price as ProductPriceRecurring}
      organization={organization}
      checkoutPath={checkoutPath}
      variant={variant}
    >
      {children}
    </AuthenticatedRecurringCheckoutButton>
  ) : (
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

interface AuthenticatedRecurringCheckoutButtonProps {
  user: UserRead
  product: Product
  price: ProductPriceRecurring
  organization: Organization
  checkoutPath: string
  variant?: ButtonProps['variant']
}

const AuthenticatedRecurringCheckoutButton: React.FC<
  React.PropsWithChildren<AuthenticatedRecurringCheckoutButtonProps>
> = ({
  product,
  price,
  organization,
  checkoutPath,
  variant = 'outline',
  children,
}) => {
  const {
    data: userSubscriptionsList,
    refetch: refetchUserSubscriptions,
    isFetched: userSubscriptionsListFetched,
  } = useUserSubscriptions({ organizationId: organization.id, active: true })
  const subscriptions = userSubscriptionsList?.items

  const isSubscribed = useMemo(
    () =>
      subscriptions &&
      subscriptions.some(
        (subscription) => subscription.product_id === product.id,
      ),
    [subscriptions, product],
  )

  const upgradableSubscription = useMemo(
    () =>
      subscriptions?.find((subscription) => subscription.price_id !== price.id),
    [subscriptions, price],
  )

  const isDowngrade = useMemo(
    () =>
      upgradableSubscription &&
      upgradableSubscription.price &&
      upgradableSubscription.price.amount_type === 'fixed' &&
      price.amount_type === 'fixed' &&
      price.price_amount < upgradableSubscription.price.price_amount,
    [upgradableSubscription, price],
  )

  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const fetched = userSubscriptionsListFetched

  const onUpgradeConfirm = useCallback(async () => {
    if (!upgradableSubscription) {
      return
    }
    await api.usersSubscriptions.update({
      id: upgradableSubscription.id,
      body: {
        product_price_id: price.id,
      },
    })
    refetchUserSubscriptions()
  }, [upgradableSubscription, price, refetchUserSubscriptions])

  const onUpgrade = useCallback(() => {
    setShowConfirmModal(true)
  }, [])

  return (
    <div className="flex w-full items-center gap-2">
      <div className="grow">
        {fetched ? (
          <>
            {isSubscribed && !upgradableSubscription && (
              <Button
                className={variant === 'outline' ? buttonClasses : ''}
                fullWidth
                disabled
                variant={variant}
                size="lg"
              >
                Subscribed
              </Button>
            )}
            {upgradableSubscription && price.amount_type === 'fixed' && (
              <>
                <Button
                  className={variant === 'outline' ? buttonClasses : ''}
                  fullWidth
                  variant={variant}
                  onClick={() => onUpgrade()}
                  size="lg"
                >
                  {isDowngrade ? 'Downgrade' : 'Upgrade'}
                </Button>
                <ConfirmModal
                  isShown={showConfirmModal}
                  hide={() => setShowConfirmModal(false)}
                  title={
                    isDowngrade
                      ? `Downgrade to ${product.name}`
                      : `Upgrade to ${product.name}`
                  }
                  description={
                    isDowngrade
                      ? `On your next invoice, you'll be billed ${formatCurrencyAndAmount(
                          price.price_amount,
                          price.price_currency,
                          0,
                        )}, minus a credit of what we already billed for the current month.`
                      : `On your next invoice, you'll be billed ${formatCurrencyAndAmount(
                          price.price_amount,
                          price.price_currency,
                          0,
                        )}, plus a proration for the current month.`
                  }
                  onConfirm={() => onUpgradeConfirm()}
                />
              </>
            )}
            {!upgradableSubscription && !isSubscribed && (
              <Link href={`${checkoutPath}?price=${price.id}`}>
                <Button
                  className={variant === 'outline' ? buttonClasses : ''}
                  fullWidth
                  variant={variant}
                  size="lg"
                >
                  {children}
                </Button>
              </Link>
            )}
          </>
        ) : (
          <Button
            fullWidth
            disabled={true}
            loading={true}
            value={'outline'}
            size="lg"
          ></Button>
        )}
      </div>
    </div>
  )
}

interface CheckoutButtonProps {
  product: Product
  recurringInterval?: SubscriptionRecurringInterval
  organization: Organization
  checkoutPath: string
  variant?: ButtonProps['variant']
}

const CheckoutButton: React.FC<
  React.PropsWithChildren<CheckoutButtonProps>
> = ({
  product,
  recurringInterval,
  organization,
  checkoutPath,
  variant,
  children,
}) => {
  const { currentUser } = useAuth()

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
    <>
      {currentUser ? (
        <AuthenticatedCheckoutButton
          user={currentUser}
          product={product}
          price={price}
          organization={organization}
          checkoutPath={checkoutPath}
          variant={variant}
        >
          {children}
        </AuthenticatedCheckoutButton>
      ) : (
        <AnonymousCheckoutButton
          price={price}
          checkoutPath={checkoutPath}
          variant={variant}
        >
          {children}
        </AnonymousCheckoutButton>
      )}
    </>
  )
}

export default CheckoutButton
