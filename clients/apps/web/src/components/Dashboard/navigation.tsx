import { Organization } from '@polar-sh/sdk'

import { isFeatureEnabled } from '@/utils/feature-flags'
import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import {
  AllInclusiveOutlined,
  AttachMoneyOutlined,
  Bolt,
  CardGiftcardOutlined,
  Construction,
  CropFreeOutlined,
  DiamondOutlined,
  Face,
  FavoriteBorderOutlined,
  HowToVoteOutlined,
  SpaceDashboardOutlined,
  TuneOutlined,
  ViewDayOutlined,
  WifiTetheringOutlined,
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
}

export const maintainerRoutes = (org: Organization): Route[] => [
  ...(isFeatureEnabled('subscriptions')
    ? [
        {
          id: 'overview',
          title: 'Overview',
          icon: (
            <SpaceDashboardOutlined className="h-5 w-5" fontSize="inherit" />
          ),
          postIcon: undefined,
          link: `/maintainer/${org.name}/overview`,
          if: true,
        },
      ]
    : []),
  ...(isFeatureEnabled('feed')
    ? [
        {
          id: 'posts',
          title: 'Posts',
          icon: <ViewDayOutlined className="h-5 w-5" fontSize="inherit" />,
          postIcon: undefined,
          link: `/maintainer/${org.name}/posts`,
          if: true,
          subs: undefined,
        },
      ]
    : []),
  ...(isFeatureEnabled('subscriptions')
    ? [
        {
          id: 'org-subscriptions',
          title: 'Subscriptions',
          icon: <Bolt className="h-5 w-5" fontSize="inherit" />,
          postIcon: undefined,
          link: `/maintainer/${org.name}/subscriptions`,
          if: true,
          subs: [
            {
              title: 'Tiers',
              link: `/maintainer/${org.name}/subscriptions/tiers`,
            },
            {
              title: 'Benefits',
              link: `/maintainer/${org.name}/subscriptions/benefits`,
            },
            {
              title: 'Subscribers',
              link: `/maintainer/${org.name}/subscriptions/subscribers`,
            },
          ],
        },
      ]
    : []),
  {
    id: 'org-issues',
    title: 'Issues',
    icon: <HowToVoteOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    link: `/maintainer/${org.name}/issues`,
    if: true,
    subs: [
      {
        title: 'Overview',
        link: `/maintainer/${org.name}/issues`,
        icon: <HowToVoteOutlined fontSize="inherit" />,
      },
      {
        title: 'Promote',
        link: `/maintainer/${org.name}/issues/promote`,
        icon: <WifiTetheringOutlined fontSize="inherit" />,
      },
      {
        title: 'Embeds',
        link: `/maintainer/${org.name}/issues/embeds`,
        icon: <CropFreeOutlined fontSize="inherit" />,
      },
    ],
  },
  {
    id: 'public-page',
    title: 'Public Page',
    link: `/${org.name}`,
    postIcon: undefined,
    icon: <ArrowUpRightIcon className="h-5 w-5" fontSize="inherit" />,
    if: true,
    subs: undefined,
  },
]

export const backerRoutes = (
  org?: Organization,
  isPersonal?: boolean,
): Route[] => [
  ...(isPersonal
    ? [
        ...(isFeatureEnabled('feed')
          ? [
              {
                id: 'posts',
                title: 'Feed',
                link: `/feed`,
                icon: (
                  <AllInclusiveOutlined
                    className="h-5 w-5"
                    fontSize="inherit"
                  />
                ),
                postIcon: undefined,
                if: isPersonal,
                subs: undefined,
              },
            ]
          : []),
        ...(isFeatureEnabled('subscriptions')
          ? [
              {
                id: 'benefits',
                title: 'Benefits',
                link: `/benefits`,
                icon: (
                  <DiamondOutlined className="h-5 w-5" fontSize="inherit" />
                ),
                postIcon: undefined,
                if: true,
                subs: undefined,
              },
            ]
          : []),
      ]
    : []),
  {
    id: 'funding',
    title: 'Funding',
    link:
      isPersonal && isFeatureEnabled('feed')
        ? `/funding` // personal and new feed
        : isPersonal
          ? '/feed' // personal and old feed
          : `/maintainer/${org?.name}/funding`, // orgs
    icon: <FavoriteBorderOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    if: true,
    subs: undefined,
  },
  ...(isFeatureEnabled('finance')
    ? []
    : [
        {
          id: 'rewards',
          title: 'Rewards',
          link: `/finance/rewards`,
          icon: <CardGiftcardOutlined className="h-5 w-5" fontSize="inherit" />,
          postIcon: undefined,
          if: isPersonal,
          subs: undefined,
        },
      ]),
  {
    id: 'members',
    title: 'Members',
    link: `/maintainer/${org?.name}/members`,
    icon: <Face fontSize="inherit" />,
    postIcon: undefined,
    if: !isPersonal && org?.is_teams_enabled,
    subs: undefined,
  },
]

export const dashboardRoutes = (
  org?: Organization,
  isPersonal?: boolean,
  isOrgAdmin?: boolean,
): Route[] => [
  ...(isFeatureEnabled('finance')
    ? [
        {
          id: 'finance',
          title: 'Finance',
          link: isPersonal ? `/finance` : `/maintainer/${org?.name}/finance`,
          icon: <AttachMoneyOutlined className="h-5 w-5" fontSize="inherit" />,
          postIcon: undefined,
          if: isOrgAdmin,
          subs: [
            {
              title: 'Incoming',
              link: isPersonal
                ? `/finance/incoming`
                : `/maintainer/${org?.name}/finance/incoming`,
            },
            {
              title: 'Outgoing',
              link: isPersonal
                ? `/finance/outgoing`
                : `/maintainer/${org?.name}/finance/outgoing`,
            },
            ...(isPersonal
              ? [
                  {
                    title: 'Issue Rewards',
                    link: `/finance/rewards`,
                  },
                ]
              : [
                  {
                    title: 'Issue Funding',
                    link: `/maintainer/${org?.name}/finance/issue-funding`,
                  },
                ]),
            {
              title: 'Payout Account',
              link: isPersonal
                ? `/finance/account`
                : `/maintainer/${org?.name}/finance/account`,
            },
          ],
        },
      ]
    : [
        {
          id: 'finance',
          title: 'Finance',
          link: `/maintainer/${org?.name}/finance`,
          icon: <AttachMoneyOutlined className="h-5 w-5" fontSize="inherit" />,
          postIcon: undefined,
          if: isOrgAdmin && !isPersonal,
          subs: undefined,
        },
      ]),
  ...(isFeatureEnabled('backoffice')
    ? [
        {
          id: 'backoffice',
          title: 'Backoffice',
          link: `/backoffice`,
          icon: <Construction className="h-5 w-5" fontSize="inherit" />,
          postIcon: undefined,
          if: false,
          subs: [
            {
              title: 'Pledges',
              link: `/backoffice/pledges`,
            },
            {
              title: 'Rewards Pending',
              link: `/backoffice/rewards_pending`,
            },
            {
              title: 'Issue Badge',
              link: `/backoffice/badge`,
            },
            {
              title: 'Rebadge',
              link: `/backoffice/rebadge`,
            },
          ],
        },
      ]
    : []),
  {
    id: 'settings',
    title: 'Settings',
    link: isPersonal ? `/settings` : `/maintainer/${org?.name}/settings`,
    icon: <TuneOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    if: isPersonal ? true : org?.is_teams_enabled && isOrgAdmin,
    subs: undefined,
  },
]

export const metaRoutes: Route[] = [
  {
    id: 'blog',
    title: 'Blog',
    link: `https://polar.sh/polarsource`,
    icon: undefined,
    postIcon: <ArrowUpRightIcon className="h-4 w-4" />,
    if: true,
    subs: undefined,
  },
  {
    id: 'docs',
    title: 'Docs & Support',
    link: `https://docs.polar.sh`,
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
