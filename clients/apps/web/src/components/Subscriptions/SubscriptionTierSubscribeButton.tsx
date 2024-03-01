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
import {
  Avatar,
  Button,
  Select,
  SelectContent,
  SelectItem,
} from 'polarkit/components/ui/atoms'
import { ButtonProps } from 'polarkit/components/ui/button'
import {
  useListAllOrganizations,
  useOrganizationSubscriptions,
  useUserSubscriptions,
} from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { useCallback, useMemo, useState } from 'react'
import { SelectTriggerBase } from '../../../../../packages/polarkit/src/components/ui/atoms/Select'
import { ConfirmModal } from '../Shared/ConfirmModal'

const buttonClasses =
  'grow transition-colors dark:hover:border-[--var-dark-border-color] dark:hover:bg-[--var-dark-border-color] dark:hover:text-[--var-dark-fg-color]'

interface AnonymousSubscriptionTierSubscribeButtonProps {
  subscriptionTier: SubscriptionTier
  subscribePath: string
  variant?: ButtonProps['variant']
}

const AnonymousSubscriptionTierSubscribeButton: React.FC<
  AnonymousSubscriptionTierSubscribeButtonProps
> = ({ subscriptionTier, subscribePath, variant = 'outline' }) => {
  return (
    <Link
      className="w-full"
      href={`${subscribePath}?tier=${subscriptionTier.id}`}
    >
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
  subscriptionTier: SubscriptionTier
  organization: Organization
  subscribePath: string
  variant?: ButtonProps['variant']
}

const AuthenticatedSubscriptionTierSubscribeButton: React.FC<
  AuthenticatedSubscriptionTierSubscribeButtonProps
> = ({
  user,
  subscriptionTier,
  organization,
  subscribePath,
  variant = 'outline',
}) => {
  const router = useRouter()

  const { data: organizationsList } = useListAllOrganizations(true)
  const organizations = useMemo(
    () =>
      organizationsList &&
      organizationsList.items &&
      organizationsList.items.filter(
        (organization) => !organization.is_personal,
      ),
    [organizationsList],
  )
  const [selectedSubscriber, setSelectedSubscriber] = useState<
    UserRead | Organization
  >(user)
  const isUserSelected = useMemo(
    () => selectedSubscriber.id === user.id,
    [selectedSubscriber, user],
  )

  const onSubscriberSelect = useCallback(
    (id: string) => {
      if (id === user.id) {
        setSelectedSubscriber(user)
      } else if (organizations) {
        const organizationIndex = organizations.findIndex(
          (organization) => organization.id === id,
        )
        if (organizationIndex > -1) {
          setSelectedSubscriber(organizations[organizationIndex])
        }
      }
    },
    [user, organizations],
  )

  const { data: userSubscriptionsList, refetch: refetchUserSubscriptions } =
    useUserSubscriptions(user.id, organization.name, 10, organization.platform)
  const {
    data: organizationSubscriptionsList,
    refetch: refetchOrganizationSubscriptions,
  } = useOrganizationSubscriptions(
    !isUserSelected ? selectedSubscriber.id : undefined,
    organization.name,
    10,
    organization.platform,
  )
  const subscriptions = isUserSelected
    ? userSubscriptionsList?.items
    : organizationSubscriptionsList?.items

  const isSubscribed = useMemo(
    () =>
      subscriptions &&
      subscriptions.some(
        (subscription) =>
          subscription.subscription_tier_id === subscriptionTier.id,
      ),
    [subscriptions, subscriptionTier],
  )
  const upgradableSubscription = useMemo(
    () =>
      subscriptions?.find(
        (subscription) =>
          subscription.subscription_tier_id !== subscriptionTier.id,
      ),
    [subscriptions, subscriptionTier],
  )
  const isDowngrade = useMemo(
    () =>
      upgradableSubscription &&
      subscriptionTier.price_amount < upgradableSubscription.price_amount,
    [upgradableSubscription, subscriptionTier],
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
      refetchUserSubscriptions()
      refetchOrganizationSubscriptions()
    }
  }, [
    upgradableSubscription,
    subscriptionTier,
    refetchUserSubscriptions,
    refetchOrganizationSubscriptions,
    router,
    subscribePath,
  ])

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
    <div className="flex w-full items-center gap-2">
      {organizations && organizations.length > 0 && (
        <Select onValueChange={onSubscriberSelect}>
          <SelectTriggerBase>
            <Avatar
              className="h-8 w-8"
              avatar_url={selectedSubscriber.avatar_url}
              name={selectedSubscriber.id}
            />
          </SelectTriggerBase>
          <SelectContent>
            <SelectItem value={user.id}>
              <div className="flex items-center gap-2">
                <Avatar avatar_url={user.avatar_url} name={user.username} />
                {user.username}
              </div>
            </SelectItem>
            {organizations.map((organization) => (
              <SelectItem value={organization.id} key={organization.id}>
                <div className="flex items-center gap-2">
                  <Avatar
                    avatar_url={organization.avatar_url}
                    name={organization.id}
                  />
                  {organization.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="grow">
        {isSubscribed && (
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
                  ? `On your next invoice, you'll be billed $${getCentsInDollarString(
                      subscriptionTier.price_amount,
                      false,
                      true,
                    )}, minus a credit of what we already billed for the current month.`
                  : `On your next invoice, you'll be billed $${getCentsInDollarString(
                      subscriptionTier.price_amount,
                      false,
                      true,
                    )}, plus a proration for the current month.`
              }
              onConfirm={() => onUpgradeConfirm()}
            />
          </>
        )}
        {!upgradableSubscription && !isSubscribed && (
          <Link
            href={`${subscribePath}?tier=${subscriptionTier.id}${
              !isUserSelected ? `&organization_id=${selectedSubscriber.id}` : ''
            }`}
          >
            <Button
              className={variant === 'outline' ? buttonClasses : ''}
              fullWidth
              variant={variant}
            >
              Subscribe
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}

interface SubscriptionTierSubscribeButtonProps {
  subscriptionTier: SubscriptionTier
  organization: Organization
  subscribePath: string
  variant?: ButtonProps['variant']
}

const SubscriptionTierSubscribeButton: React.FC<
  SubscriptionTierSubscribeButtonProps
> = ({ subscriptionTier, organization, subscribePath, variant }) => {
  const { currentUser } = useAuth()

  return (
    <>
      {!currentUser && (
        <AnonymousSubscriptionTierSubscribeButton
          subscriptionTier={subscriptionTier}
          subscribePath={subscribePath}
          variant={variant}
        />
      )}
      {currentUser && (
        <AuthenticatedSubscriptionTierSubscribeButton
          user={currentUser}
          subscriptionTier={subscriptionTier}
          organization={organization}
          subscribePath={subscribePath}
          variant={variant}
        />
      )}
    </>
  )
}

export default SubscriptionTierSubscribeButton
