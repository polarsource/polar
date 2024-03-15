import revalidate from '@/app/actions'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { useRecurringInterval } from '@/hooks/subscriptions'
import { ArrowForward } from '@mui/icons-material'
import {
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import {
  useCreateSubscriptionTier,
  useSubscriptionBenefits,
  useUpdateSubscriptionTierBenefits,
} from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useCallback, useMemo, useState } from 'react'
import { FreeTierSubscribe } from '../../Organization/FreeTierSubscribe'
import SubscriptionTierSubscribeButton from '../../Subscriptions/SubscriptionTierSubscribeButton'
import { isPremiumArticlesBenefit } from '../../Subscriptions/utils'
import SubscriptionTierRecurringIntervalSwitch from '../Subscriptions/SubscriptionTierRecurringIntervalSwitch'
import { HighlightedTiersModal } from './HighlightedTiersModal'

export interface HighlightedTiersEditorProps {
  organization: Organization
  adminOrganizations: Organization[]
  subscriptionTiers: SubscriptionTier[]
}

export const HighlightedTiersEditor = ({
  organization,
  adminOrganizations,
  subscriptionTiers,
}: HighlightedTiersEditorProps) => {
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  const isAdmin = useMemo(
    () => adminOrganizations?.some((org) => org.id === organization.id),
    [organization, adminOrganizations],
  )

  const shouldRenderSubscribeButton = !isAdmin

  const highlightedTiers = useMemo(
    () =>
      subscriptionTiers?.filter(({ type, is_highlighted }) => is_highlighted) ??
      [],
    [subscriptionTiers],
  )
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(highlightedTiers)

  const paidSubscriptionTiers = useMemo(
    () =>
      subscriptionTiers?.filter(
        ({ type }) =>
          type === SubscriptionTierType.INDIVIDUAL ||
          type === SubscriptionTierType.BUSINESS,
      ) ?? [],
    [subscriptionTiers],
  )

  if (!isAdmin && highlightedTiers.length === 0) {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-y-8">
      {isAdmin ? (
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg">Subscriptions</h2>
            <div
              className="flex cursor-pointer flex-row items-center gap-x-2 text-sm text-blue-500 dark:text-blue-400"
              onClick={showModal}
            >
              <span>Configure</span>
            </div>
          </div>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Highlight subscription tiers to feature them on your profile
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between">
            <h2>Subscriptions</h2>
            <Link
              className="text-sm text-blue-500 dark:text-blue-400"
              href={organizationPageLink(organization, 'subscriptions')}
            >
              <span>View all</span>
            </Link>
          </div>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Support {organization.name} with a subscription & receive unique
            benefits in return
          </p>
        </div>
      )}
      {hasBothIntervals && (
        <div className="flex justify-center">
          <SubscriptionTierRecurringIntervalSwitch
            recurringInterval={recurringInterval}
            onChange={setRecurringInterval}
          />
        </div>
      )}
      <div className="flex w-full flex-col gap-4">
        {highlightedTiers.length > 0 ? (
          highlightedTiers.map((tier) => (
            <SubscriptionTierCard
              className="min-h-0 w-full"
              key={tier.id}
              subscriptionTier={tier}
              variant="small"
            >
              {shouldRenderSubscribeButton ? (
                <>
                  {tier.type === 'free' ? (
                    <FreeTierSubscribe
                      subscriptionTier={tier}
                      organization={organization}
                    />
                  ) : (
                    <SubscriptionTierSubscribeButton
                      organization={organization}
                      subscriptionTier={tier}
                      recurringInterval={recurringInterval}
                      subscribePath="/api/subscribe"
                    />
                  )}
                </>
              ) : null}
            </SubscriptionTierCard>
          ))
        ) : isAdmin && paidSubscriptionTiers.length === 0 ? (
          <HighlightedTiersEditorAuthenticatedEmptyState
            organization={organization}
          />
        ) : isAdmin && paidSubscriptionTiers.length > 0 ? (
          <Button className="self-start" size="sm" onClick={showModal}>
            <div className="flex flex-row items-center gap-2">
              <span>Highlight a tier</span>
              <ArrowForward fontSize="inherit" />
            </div>
          </Button>
        ) : null}
      </div>
      <Modal
        className="lg:max-w-md"
        isShown={isModalShown}
        hide={hideModal}
        modalContent={
          <HighlightedTiersModal
            organization={organization}
            hideModal={hideModal}
            subscriptionTiers={paidSubscriptionTiers}
          />
        }
      />
    </div>
  )
}

interface HighlightedTiersEditorAuthenticatedEmptyStateProps {
  organization: Organization
}

const HighlightedTiersEditorAuthenticatedEmptyState = ({
  organization,
}: HighlightedTiersEditorAuthenticatedEmptyStateProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const { subscriptionTier, create } = useCreateBaselineTier(organization)

  const handleCreate = useCallback(async () => {
    setIsLoading(true)

    try {
      await create()
    } catch (e) {
      // Only reset loading state if there was an error
      // If successful, the component will unmount and the loading state will be irrelevant
      // This will eliminate the flashing loading state
      setIsLoading(false)
    }
  }, [create, setIsLoading])

  return (
    <div className="flex w-full flex-col gap-y-8">
      <div className="flex w-full flex-col gap-4">
        <SubscriptionTierCard
          className="min-h-0 w-full"
          subscriptionTier={subscriptionTier}
          variant="small"
        >
          <div className="flex w-full flex-col gap-2">
            <Button
              onClick={handleCreate}
              loading={isLoading}
              fullWidth
              size="sm"
            >
              Setup Suggested Tier
            </Button>
            <Link
              href={`/maintainer/${organization.name}/subscriptions/tiers/new`}
            >
              <Button variant="ghost" fullWidth size="sm">
                Create Custom
              </Button>
            </Link>
          </div>
        </SubscriptionTierCard>
      </div>
    </div>
  )
}

interface MockedBaselineTier {
  subscriptionTier: SubscriptionTier
  create: () => Promise<void>
}

const useCreateBaselineTier = (
  organization: Organization,
): MockedBaselineTier => {
  const mockedBaselineTier: SubscriptionTier = useMemo(() => {
    return {
      id: '123',
      name: 'Supporter',
      description:
        'Support my work and get access to premium posts and content in the future.',
      type: 'individual',
      benefits: [
        {
          id: '1',
          name: 'Premium posts',
          description: 'Premium posts',
          created_at: new Date().toISOString(),
          deletable: false,
          selectable: true,
          type: 'articles',
        },
      ],
      prices: [
        {
          id: '1',
          created_at: new Date().toISOString(),
          is_archived: false,
          price_amount: 500,
          price_currency: 'usd',
          recurring_interval: 'month',
        },
      ],
      created_at: new Date().toISOString(),
      is_highlighted: false,
      is_archived: false,
    }
  }, [])

  const organizationBenefits = useSubscriptionBenefits(organization.name, 99)
  const premiumArticlesBenefit = organizationBenefits.data?.items?.filter(
    isPremiumArticlesBenefit,
  )[0]

  const updateTierBenefits = useUpdateSubscriptionTierBenefits(
    organization.name,
  )

  const createTierMutation = useCreateSubscriptionTier(organization.name)

  const createBaselineTier = useCallback(async () => {
    if (!premiumArticlesBenefit) {
      return
    }

    const tier = await createTierMutation.mutateAsync({
      name: mockedBaselineTier.name,
      description: mockedBaselineTier.description,
      type: SubscriptionTierType.INDIVIDUAL,
      prices: [
        {
          price_amount: mockedBaselineTier.prices[0].price_amount,
          price_currency: mockedBaselineTier.prices[0].price_currency,
          recurring_interval: mockedBaselineTier.prices[0].recurring_interval,
        },
      ],
      is_highlighted: true,
      organization_id: organization.id,
    })

    await updateTierBenefits.mutateAsync({
      id: tier.id,
      subscriptionTierBenefitsUpdate: {
        benefits: [premiumArticlesBenefit.id],
      },
    })

    await revalidate(`subscriptionTiers:${organization.name}`)
  }, [
    organization,
    createTierMutation,
    mockedBaselineTier,
    premiumArticlesBenefit,
    updateTierBenefits,
  ])

  return {
    subscriptionTier: mockedBaselineTier,
    create: createBaselineTier,
  }
}
