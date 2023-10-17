import { Organization } from '@polar-sh/sdk'

import { isFeatureEnabled } from '@/utils/feature-flags'
import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import { CubeIcon } from '@heroicons/react/24/outline'
import {
  AttachMoneyOutlined,
  Bolt,
  CardGiftcardOutlined,
  FavoriteBorderOutlined,
  HowToVoteOutlined,
  TuneOutlined,
  WifiTethering,
} from '@mui/icons-material'

export type SubRoute = {
  readonly title: string
  readonly link: string
}

export type Route = {
  readonly id: string
  readonly title: string
  readonly icon?: React.ReactElement
  readonly postIcon?: React.ReactElement
  readonly link: string
  readonly if: boolean | undefined
  readonly subs?: SubRoute[]
}

export const maintainerRoutes = (
  org?: Organization,
  isLoaded?: boolean,
): Route[] => [
  {
    id: 'org-issues',
    title: 'Issues',
    icon: <HowToVoteOutlined className="h-6 w-6" />,
    postIcon: undefined,
    link: `/maintainer/${org?.name}/issues`,
    if: org && isLoaded,
    subs: undefined,
  },
  ...(isFeatureEnabled('subscriptions')
    ? [
        {
          id: 'org-subscriptions',
          title: 'Subscriptions',
          icon: <Bolt className="h-6 w-6" />,
          postIcon: undefined,
          link: `/maintainer/${org?.name}/subscriptions`,
          if: org && isLoaded,
          subs: [
            {
              title: 'Overview',
              link: `/maintainer/${org?.name}/subscriptions`,
            },
            {
              title: 'Tiers',
              link: `/maintainer/${org?.name}/subscriptions/tiers`,
            },
            {
              title: 'Subscribers',
              link: `/maintainer/${org?.name}/subscriptions/subscribers`,
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
    link: `/maintainer/${org?.name}/finance`,
    if: org && isLoaded,
    subs: undefined,
  },
  {
    id: 'org-promote',
    title: 'Promote',
    icon: <WifiTethering className="h-6 w-6" />,
    postIcon: undefined,
    link: `/maintainer/${org?.name}/promote`,
    if: org && isLoaded,
    subs: [
      {
        title: 'Issues',
        link: `/maintainer/${org?.name}/promote/issues`,
      },
      {
        title: 'Embeds',
        link: `/maintainer/${org?.name}/promote/embeds`,
      },
    ],
  },
  {
    id: 'public-site',
    title: 'Public site',
    link: `/${org?.name}`,
    postIcon: undefined,
    icon: <ArrowUpRightIcon className="h-4 w-4" />,
    if: org && isLoaded,
    subs: undefined,
  },

  // Non org navigation
  {
    id: 'personal-dependencies',
    title: 'Dependencies',
    icon: <CubeIcon className="h-6 w-6" />,
    postIcon: undefined,
    link: `/feed`,
    if: !org && isLoaded,
    subs: undefined,
  },
]

export const backerRoutes: Route[] = [
  {
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
    id: 'github',
    title: 'Github',
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
