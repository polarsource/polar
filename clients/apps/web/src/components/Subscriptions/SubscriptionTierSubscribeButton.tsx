import { useAuth } from '@/hooks'
import {
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
  UserRead,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { useUserSubscriptions } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { useCallback, useMemo, useState } from 'react'
import { ConfirmModal } from '../Shared/ConfirmModal'

const buttonClasses =
  'transition-colors dark:hover:border-[--var-dark-border-color] dark:hover:bg-[--var-dark-border-color] dark:hover:text-[--var-dark-fg-color]'

interface AnonymousSubscriptionTierSubscribeButtonProps {
  subscriptionTier: SubscriptionTier
  subscribePath: string
}

const AnonymousSubscriptionTierSubscribeButton: React.FC<
  AnonymousSubscriptionTierSubscribeButtonProps
> = ({ subscriptionTier, subscribePath }) => {
  return (
    <Link
      className="w-full"
      href={`${subscribePath}?tier=${subscriptionTier.id}`}
    >
      <Button className={buttonClasses} fullWidth variant="outline">
        Subscribe
      </Button>
    </Link>
  )
}

interface AuthenticatedSubscriptionTierSubscribeButtonProps {
  user: UserRead
  subscriptionTier: SubscriptionTier
  organization: Organization
  subscribePath: string
}

const AuthenticatedSubscriptionTierSubscribeButton: React.FC<
  AuthenticatedSubscriptionTierSubscribeButtonProps
> = ({ user, subscriptionTier, organization, subscribePath }) => {
  const router = useRouter()
  const { data, refetch } = useUserSubscriptions(
    user.id,
    organization.name,
    true,
    10,
    organization.platform,
  )
  const isSubscribed =
    data !== undefined &&
    data.items !== undefined &&
    data.items.some(
      (subscription) =>
        subscription.subscription_tier_id === subscriptionTier.id,
    )
  const upgradableSubscription = useMemo(
    () =>
      data?.items?.find(
        (subscription) =>
          subscription.subscription_tier_id !== subscriptionTier.id,
      ),
    [data, subscriptionTier],
  )

  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const onUpgradeConfirm = useCallback(async () => {
    if (!upgradableSubscription) {
      return
    }
    if (
      upgradableSubscription &&
      upgradableSubscription.subscription_tier.type ===
        SubscriptionTierType.FREE
    ) {
      router.push(`${subscribePath}?tier=${subscriptionTier.id}`)
    } else {
      await api.subscriptions.upgradeSubscription({
        id: upgradableSubscription.id,
        subscriptionUpgrade: {
          subscription_tier_id: subscriptionTier.id,
        },
      })
      refetch()
    }
  }, [upgradableSubscription, subscriptionTier, refetch, router, subscribePath])

  const onUpgrade = useCallback(() => {
    if (
      upgradableSubscription &&
      upgradableSubscription.subscription_tier.type ===
        SubscriptionTierType.FREE
    ) {
      onUpgradeConfirm()
    } else {
      setShowConfirmModal(true)
    }
  }, [upgradableSubscription, onUpgradeConfirm])

  return (
    <>
      {isSubscribed && (
        <Button className={buttonClasses} fullWidth disabled variant="outline">
          Subscribed
        </Button>
      )}
      {upgradableSubscription && (
        <>
          <Button
            className={buttonClasses}
            fullWidth
            variant="outline"
            onClick={() => onUpgrade()}
          >
            Upgrade
          </Button>
          <ConfirmModal
            isShown={showConfirmModal}
            hide={() => setShowConfirmModal(false)}
            title={`Upgrade to ${subscriptionTier.name}`}
            description={`On your next invoice, you'll be billed $${getCentsInDollarString(
              subscriptionTier.price_amount,
              false,
              true,
            )}, plus a proration for the current month.`}
            onConfirm={() => onUpgradeConfirm()}
          />
        </>
      )}
      {!upgradableSubscription && !isSubscribed && (
        <Link
          className="w-full"
          href={`${subscribePath}?tier=${subscriptionTier.id}`}
        >
          <Button
            className={buttonClasses}
            fullWidth
            disabled
            variant="outline"
          >
            Subscribe
          </Button>
        </Link>
      )}
    </>
  )
}

interface SubscriptionTierSubscribeButtonProps {
  subscriptionTier: SubscriptionTier
  organization: Organization
  subscribePath: string
}

const SubscriptionTierSubscribeButton: React.FC<
  SubscriptionTierSubscribeButtonProps
> = ({ subscriptionTier, organization, subscribePath }) => {
  const { currentUser } = useAuth()

  return (
    <>
      {!currentUser && (
        <AnonymousSubscriptionTierSubscribeButton
          subscriptionTier={subscriptionTier}
          subscribePath={subscribePath}
        />
      )}
      {currentUser && (
        <AuthenticatedSubscriptionTierSubscribeButton
          user={currentUser}
          subscriptionTier={subscriptionTier}
          organization={organization}
          subscribePath={subscribePath}
        />
      )}
    </>
  )
}

export default SubscriptionTierSubscribeButton
