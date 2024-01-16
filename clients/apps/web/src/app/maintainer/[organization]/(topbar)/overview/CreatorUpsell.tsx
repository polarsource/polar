import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import {
  ArrowForward,
  DiamondOutlined,
  ViewDayOutlined,
} from '@mui/icons-material'
import { Platforms } from '@polar-sh/sdk'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms'
import {
  useOrganizationArticles,
  useSubscriptionBenefits,
  useSubscriptionTiers,
} from 'polarkit/hooks'
import { useRef } from 'react'
import { useHoverDirty } from 'react-use'

const useUpsellCards = () => {
  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()

  const { data: tiers, isPending: tiersPending } = useSubscriptionTiers(
    currentOrg?.name ?? '',
  )
  const { data: posts, isPending: articlesPending } = useOrganizationArticles({
    orgName: currentOrg?.name,
    platform: Platforms.GITHUB,
    showUnpublished: false,
  })
  const { data: benefits, isPending: benefitsPending } =
    useSubscriptionBenefits(currentOrg?.name ?? '')

  const upsellCards: UpsellCardProps[] = []

  if (tiersPending || articlesPending || benefitsPending) {
    return upsellCards
  }

  if (posts?.items?.length === 0) {
    upsellCards.push({
      icon: <ViewDayOutlined className="text-blue-500 dark:text-blue-400" />,
      title: 'Write your first post',
      description: 'Start engaging with your community by writing a post',
      href: `/maintainer/${currentOrg?.name}/posts/new`,
    })
  }

  const individualTiers =
    tiers?.items?.filter((tier) => tier.type === 'individual') ?? []
  const businessTiers =
    tiers?.items?.filter((tier) => tier.type === 'business') ?? []

  if (individualTiers.length === 0) {
    upsellCards.push({
      icon: <SubscriptionGroupIcon type="individual" className="text-2xl" />,
      title: 'Setup an Individual Subscription',
      description:
        'Allow individuals to obtain a subscription, and give them benefits in return',
      href: `/maintainer/${currentOrg?.name}/subscriptions/tiers/new?type=individual`,
    })
  }

  if (businessTiers.length === 0) {
    upsellCards.push({
      icon: <SubscriptionGroupIcon type="business" className="text-2xl" />,
      title: 'Offer a Business Subscription',
      description:
        'Make it possible for companies to obtain a subscription, and offer benefits in return',
      href: `/maintainer/${currentOrg?.name}/subscriptions/tiers/new?type=business`,
    })
  }

  const nonBuiltInBenefits = benefits?.items?.filter(
    (benefit) => benefit.deletable,
  )

  if (nonBuiltInBenefits?.length === 0) {
    upsellCards.push({
      icon: <DiamondOutlined className="text-blue-500 dark:text-blue-400" />,
      title: 'Create a custom Benefit',
      description:
        'Create a custom benefit like Discord invites, consulting or private access to your repositories',
      href: `/maintainer/${currentOrg?.name}/subscriptions/benefits`,
    })
  }

  return upsellCards.slice(0, 3)
}

export const CreatorUpsell = () => {
  const cards = useUpsellCards()

  if (cards.length < 1) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-8">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 flex flex-col gap-y-8 py-6">
          <LogoIcon className="text-blue-500 dark:text-blue-400" size={48} />
          <h2 className="text-2xl font-bold">Next Up</h2>
          <p className="dark:text-polar-400 text-gray-600 [text-wrap:balance]">
            Here are a few things you can do to kickstart your community on
            Polar.
          </p>
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-6">
          {cards.map((card) => (
            <UpsellCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </div>
  )
}

export interface UpsellCardProps {
  icon: React.ReactNode
  title: string
  description: string
  href: string
}

const UpsellCard = ({ icon, title, description, href }: UpsellCardProps) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const isHovered = useHoverDirty(ref)
  return (
    <Link ref={ref} href={href} className="h-full">
      <Card className="dark:hover:bg-polar-800 relative flex h-full flex-col transition-colors hover:bg-blue-50">
        <CardHeader>{icon}</CardHeader>
        <CardContent className="flex flex-grow flex-col gap-y-6">
          <h3 className="text-lg font-medium [text-wrap:balance]">{title}</h3>
          <p className="dark:text-polar-500 text-gray-500">{description}</p>
        </CardContent>
        <CardFooter>
          <AnimatedIconButton
            active={isHovered}
            variant="secondary"
            href={href}
          >
            <ArrowForward fontSize="inherit" />
          </AnimatedIconButton>
        </CardFooter>
      </Card>
    </Link>
  )
}
