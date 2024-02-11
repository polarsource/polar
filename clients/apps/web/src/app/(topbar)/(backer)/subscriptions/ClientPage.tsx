'use client'

import { BenefitSubscriber } from '@/components/Benefit/Benefit'
import { BenefitRow } from '@/components/Benefit/BenefitRow'
import ConfigureAdCampaigns from '@/components/Benefit/ads/ConfigureAdCampaigns'
import GitHubIcon from '@/components/Icons/GitHubIcon'
import { ConfirmModal } from '@/components/Shared/ConfirmModal'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import SubscriptionTierPill from '@/components/Subscriptions/SubscriptionTierPill'
import { resolveBenefitIcon } from '@/components/Subscriptions/utils'
import { useAuth } from '@/hooks'
import { BoltOutlined, MoreVertOutlined } from '@mui/icons-material'
import { SubscriptionSubscriber } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import {
  Avatar,
  Button,
  FormattedDateTime,
  ShadowBoxOnMd,
} from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { Separator } from 'polarkit/components/ui/separator'
import { useOrganization } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'

const ClientPage = ({
  subscriptions,
}: {
  subscriptions: SubscriptionSubscriber[]
}) => {
  const { reloadUser } = useAuth()
  // Force to reload the user to make sure we have fresh data after connecting an app
  useEffect(() => {
    reloadUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [selectedBenefit, setSelectedBenefit] = useState<
    BenefitSubscriber | undefined
  >(subscriptions[0]?.subscription_tier?.benefits[0])
  const [selectedBenefitSubscription, setSelectedBenefitSubscription] =
    useState<SubscriptionSubscriber | undefined>(subscriptions[0])

  return subscriptions.length === 0 ? (
    <div className="dark:text-polar-400 flex h-full flex-col items-center gap-y-4 pt-32 text-6xl text-gray-600">
      <BoltOutlined fontSize="inherit" />
      <div className="flex flex-col items-center gap-y-2">
        <h3 className="p-2 text-xl font-medium">You have no subscriptions</h3>
        <p className="dark:text-polar-500 min-w-0 truncate text-base text-gray-500">
          Subscribe to creators & unlock benefits as a bonus
        </p>
      </div>
    </div>
  ) : (
    <div className="relative flex flex-row items-start gap-x-12">
      <div className="flex w-2/3 flex-col gap-y-4">
        {subscriptions.map((subscription) => (
          <Subscription
            key={subscription.id}
            subscription={subscription}
            selectedBenefit={selectedBenefit}
            onSelectBenefit={(b) => {
              setSelectedBenefit(b)
              setSelectedBenefitSubscription(subscription)
            }}
          />
        ))}
      </div>

      {selectedBenefitSubscription && selectedBenefit ? (
        <BenefitContextWidget
          subscription={selectedBenefitSubscription}
          benefit={selectedBenefit}
        />
      ) : null}
    </div>
  )
}

export default ClientPage

interface SubscriptionOrganizationProps {
  subscription: SubscriptionSubscriber
  selectedBenefit: BenefitSubscriber | undefined
  onSelectBenefit: (benefit: BenefitSubscriber) => void
}

const Subscription = ({
  subscription,
  selectedBenefit,
  onSelectBenefit,
}: SubscriptionOrganizationProps) => {
  const { data: org } = useOrganization(
    subscription.subscription_tier.organization_id ?? '',
  )
  const [showCancelModal, setShowCancelModal] = useState(false)
  const router = useRouter()

  const canUnsubscribe = !subscription.cancel_at_period_end
  const isFreeTier = subscription.subscription_tier.type === 'free'

  const cancelSubscription = useCallback(async () => {
    await api.subscriptions.cancelSubscription({ id: subscription.id })
    setShowCancelModal(false)
    router.refresh()
  }, [subscription])

  return (
    <ShadowBoxOnMd className="flex flex-col gap-y-8">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-x-4">
          <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
            <Avatar
              className="h-14 w-14"
              avatar_url={org?.avatar_url}
              name={org?.name ?? ''}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Link
              className="dark:text-polar-50 flex flex-row items-center gap-x-2 text-gray-950"
              href={`/${org?.name}`}
            >
              <h3>{org?.name}</h3>
            </Link>
            <div className="dark:text-polar-400 flex flex-row items-center gap-x-3 text-sm text-gray-500">
              <Link href={`/${org?.name}/subscriptions`}>
                <SubscriptionTierPill
                  amount={subscription.subscription_tier.price_amount}
                  subscriptionTier={subscription.subscription_tier}
                />
              </Link>
              {subscription.current_period_end && (
                <>
                  &middot;
                  <span
                    className={
                      subscription.cancel_at_period_end
                        ? 'text-red-500'
                        : undefined
                    }
                  >
                    <span>
                      {subscription.cancel_at_period_end
                        ? 'Ends on '
                        : 'Renews on '}
                    </span>
                    <FormattedDateTime
                      datetime={new Date(subscription.current_period_end ?? '')}
                      dateStyle="long"
                    />
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-row items-center gap-x-2">
          <Link href={`/${org?.name}/subscriptions`}>
            <Button size="sm" asChild>
              Upgrade
            </Button>
          </Link>
          {canUnsubscribe && (
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
                <Button
                  className={
                    'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                  }
                  size="icon"
                  variant="secondary"
                >
                  <MoreVertOutlined fontSize="inherit" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="dark:bg-polar-800 bg-gray-50 shadow-lg"
              >
                <DropdownMenuItem onClick={() => setShowCancelModal(true)} className="cursor-pointer">
                  Unsubscribe
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-y-4">
        <h2 className="font-medium">Benefits</h2>
        <StaggerReveal
          key={subscription.subscription_tier_id}
          className="flex flex-col gap-y-2"
        >
          {subscription.subscription_tier.benefits.map((benefit) => (
            <StaggerReveal.Child key={benefit.id}>
              <BenefitRow
                benefit={benefit}
                selected={benefit.id === selectedBenefit?.id}
                onSelect={onSelectBenefit}
              />
            </StaggerReveal.Child>
          ))}
        </StaggerReveal>
      </div>
      <ConfirmModal
        isShown={showCancelModal}
        hide={() => setShowCancelModal(false)}
        title={`Unsubscribe from ${subscription.subscription_tier.name}?`}
        description={
          isFreeTier
            ? `You won't have access to your benefits anymore.`
            : `At the end of your billing period, you won't have access to your benefits anymore.`
        }
        destructiveText="Unsubscribe"
        onConfirm={() => cancelSubscription()}
        destructive
      />
    </ShadowBoxOnMd>
  )
}

interface BenefitContextWidgetProps {
  benefit: BenefitSubscriber
  subscription: SubscriptionSubscriber
}

const GitHubRepoWidget = ({
  benefit,
  subscription,
}: BenefitContextWidgetProps) => {
  if (benefit.type !== 'github_repository') {
    return <></>
  }

  const orgName = benefit.properties.repository_owner
  const repoName = benefit.properties.repository_name
  const githubURL = `https://github.com/${orgName}/${repoName}`

  return (
    <>
      <Link href={`${githubURL}/invitations`}>
        <Button variant="outline" asChild>
          <GitHubIcon width={16} height={16} className="mr-2" />
          Goto {orgName}/{repoName}
        </Button>
      </Link>
    </>
  )
}

const BenefitContextWidget = ({
  benefit,
  subscription,
}: BenefitContextWidgetProps) => {
  const { data: org } = useOrganization(benefit?.organization_id ?? '')

  return (
    <ShadowBoxOnMd className="sticky top-28 flex w-1/3 flex-col gap-y-6">
      <div className="flex flex-row items-center gap-x-2">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
          <span className="flex h-6 w-6 flex-row items-center justify-center rounded-full bg-blue-50 text-sm dark:bg-blue-950">
            {resolveBenefitIcon(benefit, 'inherit')}
          </span>
        </div>
        <h2 className="font-medium capitalize">
          {benefit.type === 'github_repository'
            ? 'GitHub Repository Access'
            : benefit.type}
        </h2>
      </div>
      <p className="dark:text-polar-500 text-sm text-gray-500">
        {benefit.description}
      </p>
      {benefit.type === 'custom' && benefit.properties.note && (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950">
          <p className="mb-4 font-medium">Note from {org?.name}</p>
          <p className="whitespace-pre-line">{benefit.properties.note}</p>
        </div>
      )}

      {benefit.type === 'github_repository' && (
        <GitHubRepoWidget benefit={benefit} subscription={subscription} />
      )}

      {benefit.type === 'ads' ? (
        <ConfigureAdCampaigns benefit={benefit} subscription={subscription} />
      ) : null}

      <Separator />
      <div className="flex flex-col gap-y-2">
        <div className="flex flex-row items-center gap-x-2">
          <Avatar
            className="h-8 w-8"
            avatar_url={org?.avatar_url}
            name={org?.name ?? ''}
          />
          <Link
            className="text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
            href={`/${org?.name}`}
          >
            {org?.name}
          </Link>
        </div>
      </div>
    </ShadowBoxOnMd>
  )
}
