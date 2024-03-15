import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { DiscordIcon } from '@/components/Subscriptions/utils'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import {
  CloseOutlined,
  DonutLargeOutlined,
  ViewDayOutlined,
  WifiTetheringOutlined,
} from '@mui/icons-material'
import { Platforms } from '@polar-sh/sdk'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useOrganizationArticles, useSubscriptionTiers } from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useCallback, useEffect, useRef, useState } from 'react'

const ONBOARDING_MAP_KEY = 'creator_onboarding'

interface OnboardingMap {
  postCreated: boolean
  subscriptionTierCreated: boolean
  polarPageShared: boolean
  fundingInYaml: boolean
  joinDiscord: boolean
}

const useUpsellSteps = () => {
  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()
  const [upsellSteps, setUpsellSteps] = useState<UpsellStepProps[]>([])
  const [onboardingCompletedMap, setOnboardingCompletedMap] = useState<
    Partial<OnboardingMap>
  >(JSON.parse(localStorage.getItem(ONBOARDING_MAP_KEY) ?? '{}'))

  const { data: tiers, isPending: tiersPending } = useSubscriptionTiers(
    currentOrg?.name ?? '',
  )
  const { data: posts, isPending: articlesPending } = useOrganizationArticles({
    orgName: currentOrg?.name,
    platform: Platforms.GITHUB,
    showUnpublished: false,
  })

  const handleDismiss = useCallback(
    (onboardingKey: keyof OnboardingMap) => {
      setOnboardingCompletedMap((prev) => ({
        ...prev,
        [onboardingKey]: true,
      }))
    },
    [setOnboardingCompletedMap],
  )

  useEffect(() => {
    const steps: UpsellStepProps[] = []

    if (!currentOrg) {
      return
    }

    if (!onboardingCompletedMap.polarPageShared) {
      steps.push({
        icon: (
          <WifiTetheringOutlined className="text-2xl text-blue-500 dark:text-blue-400" />
        ),
        title: 'Setup & Share your Polar page',
        description:
          'Customize & promote on social media and GitHub to receive free- and paid subscribers',
        href: organizationPageLink(currentOrg),
        onboardingKey: 'polarPageShared',
        onDismiss: handleDismiss,
      })
    }

    if (posts?.items?.length === 0 && !onboardingCompletedMap.postCreated) {
      steps.push({
        icon: <ViewDayOutlined className="text-blue-500 dark:text-blue-400" />,
        title: 'Write your first post',
        description:
          'Start building a community & newsletter by writing your first post – your hello world on Polar',
        href: `/maintainer/${currentOrg?.name}/posts/new`,
        onboardingKey: 'postCreated',
        onDismiss: handleDismiss,
      })
    }

    const nonFreeTiers =
      tiers?.items?.filter((tier) => tier.type !== 'free') ?? []

    if (
      nonFreeTiers.length === 0 &&
      !onboardingCompletedMap.subscriptionTierCreated
    ) {
      steps.push({
        icon: <SubscriptionGroupIcon type="individual" className="text-2xl" />,
        title: 'Setup paid subscriptions & membership benefits',
        description:
          'Offer built-in benefits like premium posts, Discord invites, sponsor ads & private GitHub repository access',
        href: `/maintainer/${currentOrg?.name}/subscriptions/tiers`,
        onboardingKey: 'subscriptionTierCreated',
        onDismiss: handleDismiss,
      })
    }

    if (!onboardingCompletedMap.fundingInYaml) {
      steps.push({
        icon: (
          <LogoIcon className="-mr-2 h-8 w-8 text-blue-500 dark:text-blue-400" />
        ),
        title: 'Add Polar to your FUNDING.yml',
        description: `Add 'polar: ${currentOrg?.name}' to your FUNDING.yml to link your Polar page with your GitHub repository`,
        href: `/maintainer/${currentOrg?.name}/promote`,
        onboardingKey: 'fundingInYaml',
        onDismiss: handleDismiss,
      })
    }

    if (!onboardingCompletedMap.joinDiscord) {
      steps.push({
        icon: <DiscordIcon className="text-[#5765f2]" size={26} />,
        title: 'Join the Polar Discord community',
        description: `Receive help, share feedback & connect with other creators`,
        href: `https://discord.com/invite/STfRufb32V`,
        newTab: true,
        onboardingKey: 'fundingInYaml',
        onDismiss: handleDismiss,
      })
    }

    setUpsellSteps(steps)
  }, [currentOrg, onboardingCompletedMap, posts, tiers, handleDismiss])

  if (tiersPending || articlesPending) {
    return []
  } else {
    return upsellSteps
  }
}

export const CreatorUpsell = () => {
  const steps = useUpsellSteps()

  if (steps.length < 1) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex grid-cols-2 flex-col gap-6 md:grid xl:grid-cols-3">
        <div className="col-span-2 flex flex-col gap-y-4 md:gap-y-6 md:py-6 lg:col-span-1">
          <DonutLargeOutlined
            className="hidden text-blue-500 md:block dark:text-blue-400"
            fontSize="large"
          />
          <h2 className="text-2xl font-bold">Next Up</h2>
          <p className="dark:text-polar-400 text-gray-600 [text-wrap:balance]">
            Here are a few things you can do to reach your next goal on Polar
          </p>
        </div>
        <div className="col-span-2 flex flex-col gap-y-4">
          {steps.slice(0, 3).map((card) => (
            <UpsellStep key={card.title} {...card} />
          ))}
        </div>
      </div>
    </div>
  )
}

export interface UpsellStepProps {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  newTab?: boolean
  onboardingKey: keyof OnboardingMap
  onDismiss: (onboardingKey: keyof OnboardingMap) => void
}

const UpsellStep = ({
  icon,
  title,
  description,
  href,
  onboardingKey,
  newTab,
  onDismiss,
}: UpsellStepProps) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const [dismissed, setDismissed] = useState(false)

  const handleDismiss = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const onboardingCompletedMap: Partial<OnboardingMap> = JSON.parse(
      localStorage.getItem(ONBOARDING_MAP_KEY) ?? '{}',
    )
    onboardingCompletedMap[onboardingKey] = true
    localStorage.setItem(
      ONBOARDING_MAP_KEY,
      JSON.stringify(onboardingCompletedMap),
    )

    setDismissed(true)

    onDismiss(onboardingKey)
  }

  if (dismissed) {
    return null
  }

  return (
    <Link
      ref={ref}
      href={href}
      className="relative"
      target={newTab ? '_blank' : '_self'}
    >
      <ShadowBox className="dark:hover:bg-polar-800 relative flex h-full flex-row items-end justify-between transition-colors hover:bg-blue-50">
        <div className="flex w-3/4 flex-row gap-x-6">
          <div>{icon}</div>
          <div className="flex flex-col gap-y-2">
            <h3 className="mt-0 text-lg font-medium [text-wrap:balance]">
              {title}
            </h3>
            <p className="dark:text-polar-500 text-gray-500 [text-wrap:pretty]">
              {description}
            </p>
          </div>
        </div>
      </ShadowBox>

      <div
        className="dark:text-polar-500 dark:hover:text-polar-300 absolute right-4 top-4 cursor-pointer p-2 text-gray-300 hover:text-gray-500"
        onClick={handleDismiss}
      >
        <CloseOutlined fontSize="inherit" />
      </div>
    </Link>
  )
}
