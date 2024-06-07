import revalidate from '@/app/actions'
import { isPremiumArticlesBenefit } from '@/components/Benefit/utils'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import CheckoutButton from '@/components/Products/CheckoutButton'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { useRecurringInterval } from '@/hooks/products'
import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { organizationPageLink } from '@/utils/nav'
import { ArrowForward } from '@mui/icons-material'
import {
  Organization,
  Product,
  ProductPriceRecurringCreate,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { useCallback, useMemo, useState } from 'react'
import { FreeTierSubscribe } from '../../Organization/FreeTierSubscribe'
import SubscriptionTierRecurringIntervalSwitch from '../../Subscriptions/SubscriptionTierRecurringIntervalSwitch'
import { hasRecurringInterval } from '../../Subscriptions/utils'
import { HighlightedTiersModal } from './HighlightedTiersModal'

export interface HighlightedTiersEditorProps {
  organization: Organization
  adminOrganizations: Organization[]
  products: Product[]
}

export const HighlightedTiersEditor = ({
  organization,
  adminOrganizations,
  products,
}: HighlightedTiersEditorProps) => {
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  const isAdmin = useMemo(
    () => adminOrganizations.some((org) => org.id === organization.id),
    [organization, adminOrganizations],
  )

  const shouldRenderSubscribeButton = !isAdmin

  const highlightedTiers = useMemo(
    () => products?.filter(({ is_highlighted }) => is_highlighted) ?? [],
    [products],
  )
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(highlightedTiers)

  const paidSubscriptionTiers = useMemo(
    () =>
      products?.filter(
        ({ type }) =>
          type === SubscriptionTierType.INDIVIDUAL ||
          type === SubscriptionTierType.BUSINESS,
      ) ?? [],
    [products],
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
          <p className="dark:text-white0 text-sm text-gray-500">
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
          <p className="dark:text-white0 text-sm text-gray-500">
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
      <div className="-mx-4 flex flex-row justify-start gap-6 overflow-x-auto px-4 pb-4 md:mx-0 md:flex-col md:gap-6 md:p-0">
        {highlightedTiers.length > 0 ? (
          highlightedTiers
            .filter(hasRecurringInterval(recurringInterval))
            .map((tier) => (
              <SubscriptionTierCard
                className="min-h-0 w-full max-w-[260px] shrink-0 md:max-w-full"
                key={tier.id}
                subscriptionTier={tier}
                variant="small"
                recurringInterval={recurringInterval}
              >
                {shouldRenderSubscribeButton ? (
                  <>
                    {tier.type === 'free' ? (
                      <FreeTierSubscribe
                        product={tier}
                        organization={organization}
                      />
                    ) : (
                      <CheckoutButton
                        organization={organization}
                        product={tier}
                        recurringInterval={recurringInterval}
                        checkoutPath="/api/checkout"
                      >
                        Subscribe
                      </CheckoutButton>
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
              href={`/maintainer/${organization.name}/subscriptions/tiers?new`}
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
  subscriptionTier: Product
  create: () => Promise<void>
}

const useCreateBaselineTier = (
  organization: Organization,
): MockedBaselineTier => {
  const mockedBaselineTier: Product & {
    prices: ProductPriceRecurringCreate[]
  } = useMemo(() => {
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
          organization_id: organization.id,
        },
      ],
      prices: [
        {
          id: '1',
          created_at: new Date().toISOString(),
          is_archived: false,
          price_amount: 500,
          price_currency: 'usd',
          type: 'recurring',
          recurring_interval: 'month',
        },
      ],
      created_at: new Date().toISOString(),
      is_highlighted: false,
      is_archived: false,
      is_recurring: true,
      organization_id: organization.id,
    }
  }, [organization])

  const organizationBenefits = useBenefits(organization.id, 99)
  const premiumArticlesBenefit = organizationBenefits.data?.items?.filter(
    isPremiumArticlesBenefit,
  )[0]

  const updateProductBenefits = useUpdateProductBenefits(organization.id)

  const createProductMutation = useCreateProduct(organization.id)

  const createBaselineProduct = useCallback(async () => {
    if (!premiumArticlesBenefit) {
      return
    }

    const product = await createProductMutation.mutateAsync({
      name: mockedBaselineTier.name,
      description: mockedBaselineTier.description,
      type: SubscriptionTierType.INDIVIDUAL,
      prices: mockedBaselineTier.prices,
      is_highlighted: true,
      organization_id: organization.id,
    })

    await updateProductBenefits.mutateAsync({
      id: product.id,
      productBenefitsUpdate: {
        benefits: [premiumArticlesBenefit.id],
      },
    })

    revalidate(`products:${organization.id}:recurring`)
    revalidate(`products:${organization.id}:one_time`)
  }, [
    organization,
    createProductMutation,
    mockedBaselineTier,
    premiumArticlesBenefit,
    updateProductBenefits,
  ])

  return {
    subscriptionTier: mockedBaselineTier,
    create: createBaselineProduct,
  }
}
