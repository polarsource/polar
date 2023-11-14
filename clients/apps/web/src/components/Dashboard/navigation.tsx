import { Organization } from '@polar-sh/sdk'

import { isFeatureEnabled } from '@/utils/feature-flags'
import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import {
  AttachMoneyOutlined,
  Bolt,
  CardGiftcardOutlined,
  CropFreeOutlined,
  DragIndicatorOutlined,
  Face,
  FavoriteBorderOutlined,
  HowToVoteOutlined,
  StreamOutlined,
  TuneOutlined,
  WidthNormalOutlined,
  WifiTethering,
} from '@mui/icons-material'

export type SubRoute = {
  readonly title: string
  readonly link: string
  readonly icon?: React.ReactNode
}

export type Route = {
  readonly id: string
  readonly title: string
  readonly icon?: React.ReactElement
  readonly postIcon?: React.ReactElement
  readonly link: string
  readonly if: boolean | undefined
  readonly subs?: SubRoute[]
  readonly hideTopbar?: boolean
}

export const maintainerRoutes = (org: Organization): Route[] => [
  {
    id: 'org-issues',
    title: 'Issues',
    icon: <HowToVoteOutlined className="h-6 w-6" />,
    postIcon: undefined,
    link: `/maintainer/${org.name}/issues`,
    if: true,
    subs: undefined,
  },
  ...(isFeatureEnabled('subscriptions')
    ? [
        {
          id: 'org-subscriptions',
          title: 'Subscriptions',
          icon: <Bolt className="h-6 w-6" />,
          postIcon: undefined,
          link: `/maintainer/${org.name}/subscriptions`,
          if: true,
          subs: [
            {
              title: 'Overview',
              link: `/maintainer/${org.name}/subscriptions`,
              icon: <DragIndicatorOutlined fontSize="inherit" />,
            },
            {
              title: 'Tiers',
              link: `/maintainer/${org.name}/subscriptions/tiers`,
              icon: <WidthNormalOutlined fontSize="inherit" />,
            },
            {
              title: 'Subscribers',
              link: `/maintainer/${org.name}/subscriptions/subscribers`,
              icon: <Face fontSize="inherit" />,
            },
          ],
        },
      ]
    : []),
  {
    id: 'org-finance',
    title: 'Finance',
    icon: <AttachMoneyOutlined className="h-6 w-6" />,
    postIcon: undefined,
    link: `/maintainer/${org.name}/finance`,
    if: true,
    subs: undefined,
  },
  {
    id: 'org-promote',
    title: 'Promote',
    icon: <WifiTethering className="h-6 w-6" />,
    postIcon: undefined,
    link: `/maintainer/${org.name}/promote`,
    if: true,
    subs: [
      {
        title: 'Issues',
        link: `/maintainer/${org.name}/promote/issues`,
        icon: <HowToVoteOutlined fontSize="inherit" />,
      },
      {
        title: 'Embeds',
        link: `/maintainer/${org.name}/promote/embeds`,
        icon: <CropFreeOutlined fontSize="inherit" />,
      },
    ],
  },
  {
    id: 'public-site',
    title: 'Public site',
    link: `/${org.name}`,
    postIcon: undefined,
    icon: <ArrowUpRightIcon className="h-6 w-6" />,
    if: true,
    subs: undefined,
  },
  {
    id: 'team',
    title: org.name,
    link: `/team/${org.name}`,
    postIcon: undefined,
    icon: <ArrowUpRightIcon className="h-6 w-6" />,
    if: false, // Hidden for now
    subs: [
      {
        title: 'Funding',
        link: `/team/${org.name}/funding`,
        icon: <FavoriteBorderOutlined fontSize="inherit" />,
      },
      {
        title: 'Members',
        link: `/team/${org.name}/members`,
        icon: <Face fontSize="inherit" />,
      },
      {
        title: 'Settings',
        link: `/team/${org.name}/settings`,
        icon: <TuneOutlined fontSize="inherit" />,
      },
    ],
  },
]

export const backerRoutes: Route[] = [
  isFeatureEnabled('feed')
    ? {
        id: 'feed',
        title: 'Feed',
        link: `/feed`,
        icon: <StreamOutlined className="h-6 w-6" />,
        postIcon: undefined,
        if: true,
        subs: undefined,
        hideTopbar: true,
      }
    : {
        id: 'funding',
        title: 'Funding',
        link: `/feed`,
        icon: <FavoriteBorderOutlined className="h-6 w-6" />,
        postIcon: undefined,
        if: true,
        subs: undefined,
      },
  {
    id: 'rewards',
    title: 'Rewards',
    link: `/rewards`,
    icon: <CardGiftcardOutlined className="h-6 w-6" />,
    postIcon: undefined,
    if: true,
    subs: undefined,
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/settings`,
    icon: <TuneOutlined className="h-6 w-6" />,
    postIcon: undefined,
    if: true,
    subs: undefined,
  },
]

export const metaRoutes: Route[] = [
  {
    id: 'blog',
    title: 'Blog',
    link: `https://blog.polar.sh`,
    icon: undefined,
    postIcon: <ArrowUpRightIcon className="h-4 w-4" />,
    if: true,
    subs: undefined,
  },
  {
    id: 'github',
    title: 'GitHub',
    link: `https://github.com/polarsource/polar`,
    icon: undefined,
    postIcon: <ArrowUpRightIcon className="h-4 w-4" />,
    if: true,
    subs: undefined,
  },
  {
    id: 'discord',
    title: 'Join our Discord',
    link: `https://discord.gg/STfRufb32V`,
    icon: undefined,
    postIcon: <ArrowUpRightIcon className="h-4 w-4" />,
    if: true,
    subs: undefined,
  },
]
