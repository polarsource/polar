import { useAuth } from '@/hooks'
import { useUserSubscriptions } from '@/hooks/queries'
import { api } from '@/utils/api'
import { formatCurrencyAndAmount } from '@/utils/money'
import {
  Organization,
  Product,
  ProductPrice,
  ProductPriceRecurringInterval,
  ProductPriceType,
  SubscriptionTierType,
  UserRead,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button, { ButtonProps } from 'polarkit/components/ui/atoms/button'
import { useCallback, useMemo, useState } from 'react'
import { ConfirmModal } from '../Modal/ConfirmModal'

const buttonClasses =
  'grow transition-colors dark:hover:border-[--var-dark-border-color] dark:hover:bg-[--var-dark-border-color] dark:hover:text-[--var-dark-fg-color]'

interface AnonymousSubscriptionTierSubscribeButtonProps {
  price: ProductPrice
  checkoutPath: string
  variant?: ButtonProps['variant']
}

const AnonymousSubscriptionTierSubscribeButton: React.FC<
  AnonymousSubscriptionTierSubscribeButtonProps
> = ({ price, checkoutPath, variant = 'outline' }) => {
  return (
    <Link className="w-full" href={`${checkoutPath}?price=${price.id}`}>
      <Button
        className={variant === 'outline' ? buttonClasses : ''}
        fullWidth
        variant={variant}
      >
        Subscribe
      </Button>
    </Link>
  )
}

interface AuthenticatedSubscriptionTierSubscribeButtonProps {
  user: UserRead
  subscriptionTier: Product
  price: ProductPrice
  organization: Organization
  checkoutPath: string
  variant?: ButtonProps['variant']
}

const AuthenticatedSubscriptionTierSubscribeButton: React.FC<
  AuthenticatedSubscriptionTierSubscribeButtonProps
> = ({
  user,
  subscriptionTier,
  price,
  organization,
  checkoutPath,
  variant = 'outline',
}) => {
  const router = useRouter()

  const {
    data: userSubscriptionsList,
    refetch: refetchUserSubscriptions,
    isFetched: userSubscriptionsListFetched,
  } = useUserSubscriptions(
    user.id,
    organization.name,
    10,
    organization.platform,
  )
  const subscriptions = userSubscriptionsList?.items

  const isSubscribed = useMemo(
    () =>
      subscriptions &&
      subscriptions.some(
        (subscription) => subscription.product_id === subscriptionTier.id,
      ),
    [subscriptions, subscriptionTier],
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
      price.price_amount < upgradableSubscription.price.price_amount,
    [upgradableSubscription, price],
  )

  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const fetched = userSubscriptionsListFetched

  const onUpgradeConfirm = useCallback(async () => {
    if (!upgradableSubscription) {
      return
    }
    if (
      upgradableSubscription &&
      upgradableSubscription.product.type === SubscriptionTierType.FREE
    ) {
      router.push(`${checkoutPath}?price=${price.id}`)
    } else {
      await api.subscriptions.upgradeSubscription({
        id: upgradableSubscription.id,
        subscriptionUpgrade: {
          subscription_tier_id: subscriptionTier.id,
          price_id: price.id,
        },
      })
      refetchUserSubscriptions()
    }
  }, [
    upgradableSubscription,
    subscriptionTier,
    price,
    refetchUserSubscriptions,
    router,
    checkoutPath,
  ])

  const onUpgrade = useCallback(() => {
    if (
      upgradableSubscription &&
      upgradableSubscription.product.type === SubscriptionTierType.FREE
    ) {
      onUpgradeConfirm()
    } else {
      setShowConfirmModal(true)
    }
  }, [upgradableSubscription, onUpgradeConfirm])

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
              >
                Subscribed
              </Button>
            )}
            {upgradableSubscription && (
              <>
                <Button
                  className={variant === 'outline' ? buttonClasses : ''}
                  fullWidth
                  variant={variant}
                  onClick={() => onUpgrade()}
                >
                  {isDowngrade ? 'Downgrade' : 'Upgrade'}
                </Button>
                <ConfirmModal
                  isShown={showConfirmModal}
                  hide={() => setShowConfirmModal(false)}
                  title={
                    isDowngrade
                      ? `Downgrade to ${subscriptionTier.name}`
                      : `Upgrade to ${subscriptionTier.name}`
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
                >
                  Subscribe
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
          ></Button>
        )}
      </div>
    </div>
  )
}

interface SubscriptionTierSubscribeButtonProps {
  subscriptionTier: Product
  recurringInterval: ProductPriceRecurringInterval
  organization: Organization
  checkoutPath: string
  variant?: ButtonProps['variant']
}

const SubscriptionTierSubscribeButton: React.FC<
  SubscriptionTierSubscribeButtonProps
> = ({
  subscriptionTier,
  recurringInterval,
  organization,
  checkoutPath,
  variant,
}) => {
  const { currentUser } = useAuth()

  const price = useMemo(() => {
    const price = subscriptionTier.prices?.find(
      (price) =>
        price.type === ProductPriceType.RECURRING &&
        price.recurring_interval === recurringInterval,
    )
    if (!price) {
      return subscriptionTier.prices[0]
    }
    return price
  }, [subscriptionTier, recurringInterval])

  return (
    <>
      {currentUser ? (
        <AuthenticatedSubscriptionTierSubscribeButton
          user={currentUser}
          subscriptionTier={subscriptionTier}
          price={price}
          organization={organization}
          checkoutPath={checkoutPath}
          variant={variant}
        />
      ) : (
        <AnonymousSubscriptionTierSubscribeButton
          price={price}
          checkoutPath={checkoutPath}
          variant={variant}
        />
      )}
    </>
  )
}

export default SubscriptionTierSubscribeButton
