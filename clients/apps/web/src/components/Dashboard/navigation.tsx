import { Organization } from '@polar-sh/sdk'

import { shouldBeOnboarded } from '@/hooks/onboarding'
import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import {
  AllInclusiveOutlined,
  AttachMoneyOutlined,
  DiamondOutlined,
  FavoriteBorderOutlined,
  HowToVoteOutlined,
  ShoppingCartOutlined,
  SpaceDashboardOutlined,
  StickyNote2Outlined,
  TuneOutlined,
  VolunteerActivismOutlined,
  Webhook,
  WifiTetheringOutlined,
} from '@mui/icons-material'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

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
  readonly selectedExactMatchOnly?: boolean
  readonly selectedMatchFallback?: boolean
  readonly checkIsActive?: (currentPath: string) => boolean
}

export type SubRouteWithActive = SubRoute & { readonly isActive: boolean }

export type RouteWithActive = Route & {
  readonly isActive: boolean
  readonly subs?: SubRouteWithActive[]
}

const applySubRouteIsActive = (
  path: string,
): ((r: SubRoute) => SubRouteWithActive) => {
  return (r: SubRoute): SubRouteWithActive => {
    const isActive = r.link === path
    return {
      ...r,
      isActive,
    }
  }
}

const applyIsActive = (path: string): ((r: Route) => RouteWithActive) => {
  return (r: Route): RouteWithActive => {
    let isActive = false

    if (r.checkIsActive !== undefined) {
      isActive = r.checkIsActive(path)
    } else {
      // Fallback
      isActive = Boolean(path && path.startsWith(r.link))
    }

    const subs = r.subs ? r.subs.map(applySubRouteIsActive(path)) : undefined

    return {
      ...r,
      isActive,
      subs,
    }
  }
}

export const useMaintainerRoutes = (
  org?: Organization,
  allowAll?: boolean,
): RouteWithActive[] => {
  const path = usePathname()

  const r = useMemo(() => {
    if (!org) {
      return []
    }

    return maintainerRoutesList(org)
      .filter((o) => allowAll || o.if)
      .map(applyIsActive(path))
  }, [org, path, allowAll])

  return r
}

export const useMaintainerDisabledRoutes = (
  org?: Organization,
): RouteWithActive[] => {
  const path = usePathname()

  const r = useMemo(() => {
    if (!org) {
      return []
    }

    return maintainerRoutesList(org)
      .filter((o) => {
        switch (o.id) {
          case 'org-issues':
          case 'newsletter':
          case 'products':
          case 'donations':
            return true
          default:
            return false
        }
      })
      .filter((o) => !o.if)
      .map(applyIsActive(path))
  }, [org, path])

  return r
}

export const useDashboardRoutes = (
  org: Organization | undefined,
): RouteWithActive[] => {
  const path = usePathname()

  if (!org || shouldBeOnboarded(org)) {
    return []
  }

  return dashboardRoutesList(org)
    .filter((o) => o.if)
    .map(applyIsActive(path))
}

export const useBackerRoutes = (): RouteWithActive[] => {
  const path = usePathname()
  return backerRoutesList()
    .filter((o) => o.if)
    .map(applyIsActive(path))
}

export const usePersonalFinanceSubRoutes = (): SubRouteWithActive[] => {
  const path = usePathname()
  return personalFinanceSubRoutesList().map(applySubRouteIsActive(path))
}

// internals below

const maintainerRoutesList = (org: Organization): Route[] => [
  {
    id: 'overview',
    title: 'Overview',
    icon: <SpaceDashboardOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    link: `/maintainer/${org.slug}/overview`,
    if: true,
  },
  {
    id: 'newsletter',
    title: 'Newsletter',
    icon: <StickyNote2Outlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    link: `/maintainer/${org.slug}/posts`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/maintainer/${org.slug}/posts`)
    },
    if: org.feature_settings?.articles_enabled,
  },
  {
    id: 'products',
    title: 'Products',
    icon: <DiamondOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    link: `/maintainer/${org.slug}/products/overview`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/maintainer/${org.slug}/products`)
    },
    if: org.feature_settings?.subscriptions_enabled,
    subs: [
      {
        title: 'Overview',
        link: `/maintainer/${org.slug}/products/overview`,
      },
      {
        title: 'Benefits',
        link: `/maintainer/${org.slug}/products/benefits`,
      },
    ],
  },
  {
    id: 'org-sales',
    title: 'Sales',
    icon: <ShoppingCartOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    link: `/maintainer/${org.slug}/sales/overview`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/maintainer/${org.slug}/sales`)
    },
    if: org.feature_settings?.subscriptions_enabled,
    subs: [
      {
        title: 'Overview',
        link: `/maintainer/${org.slug}/sales/overview`,
      },
      {
        title: 'Orders',
        link: `/maintainer/${org.slug}/sales/orders`,
      },
      {
        title: 'Subscriptions',
        link: `/maintainer/${org.slug}/sales/subscriptions`,
      },
    ],
  },
  {
    id: 'donations',
    title: 'Donations',
    icon: <VolunteerActivismOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    link: `/maintainer/${org.slug}/donations/overview`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/maintainer/${org.slug}/donations`)
    },
    if: org.donations_enabled,
  },
  {
    id: 'org-issues',
    title: 'Issues',
    icon: <HowToVoteOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    link: `/maintainer/${org.slug}/issues/overview`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/maintainer/${org.slug}/issues`)
    },
    if: org.feature_settings?.issue_funding_enabled,
    subs: [
      {
        title: 'Overview',
        link: `/maintainer/${org.slug}/issues/overview`,
      },
      {
        title: 'Badge',
        link: `/maintainer/${org.slug}/issues/badge`,
      },
      {
        title: 'Organizations',
        link: `/maintainer/${org.slug}/issues/organizations`,
      },
    ],
  },
  {
    id: 'funding',
    title: 'Funding',
    link: `/maintainer/${org.slug}/funding`,
    icon: <FavoriteBorderOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    if: true,
    subs: undefined,
  },
  {
    id: 'promote',
    title: 'Promote',
    icon: <WifiTetheringOutlined fontSize="inherit" />,
    postIcon: undefined,
    link: `/maintainer/${org.slug}/promote`,
    if: true,
    subs: undefined,
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    icon: <Webhook fontSize="inherit" />,
    postIcon: undefined,
    link: `/maintainer/${org.slug}/webhooks`,
    if: false,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(
        `/maintainer/${org.slug}/settings/webhooks`,
      )
    },
  },
]

const backerRoutesList = (): Route[] => [
  {
    id: 'posts',
    title: 'Feed',
    link: `/feed`,
    icon: <AllInclusiveOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    if: true,
    subs: undefined,
  },
  {
    id: 'purchases',
    title: 'Purchases',
    link: `/purchases`,
    icon: <DiamondOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    if: true,
    subs: undefined,
  },
  {
    id: 'funding',
    title: 'Funded Issues',
    link: `/funding`,
    icon: <HowToVoteOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    if: true,
    subs: undefined,
  },
  {
    id: 'finance',
    title: 'Finance',
    link: `/finance`,
    icon: <AttachMoneyOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    if: true,
    subs: personalFinanceSubRoutesList(),
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/settings`,
    icon: <TuneOutlined className="h-5 w-5" fontSize="inherit" />,
    postIcon: undefined,
    if: true,
    subs: undefined,
  },
]

const personalFinanceSubRoutesList = (): SubRoute[] => [
  {
    title: 'Incoming',
    link: `/finance/incoming`,
  },
  {
    title: 'Outgoing',
    link: `/finance/outgoing`,
  },
  {
    title: 'Issue Rewards',
    link: `/finance/rewards`,
  },
  {
    title: 'Payout Account',
    link: `/finance/account`,
  },
]

const orgFinanceSubRoutesList = (org: Organization): SubRoute[] => [
  {
    title: 'Incoming',
    link: `/maintainer/${org.slug}/finance/incoming`,
  },
  {
    title: 'Outgoing',
    link: `/maintainer/${org.slug}/finance/outgoing`,
  },
  {
    title: 'Issue Funding',
    link: `/maintainer/${org.slug}/finance/issue-funding`,
  },

  {
    title: 'Payout Account',
    link: `/maintainer/${org.slug}/finance/account`,
  },
]

const dashboardRoutesList = (org: Organization): Route[] => [
  {
    id: 'finance',
    title: 'Finance',
    link: `/maintainer/${org.slug}/finance`,
    icon: <AttachMoneyOutlined className="h-5 w-5" fontSize="inherit" />,
    if: true,
    subs: orgFinanceSubRoutesList(org),
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/maintainer/${org.slug}/settings`,
    icon: <TuneOutlined className="h-5 w-5" fontSize="inherit" />,
    if: true,
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
    link: '/docs',
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

export const unauthenticatedRoutes: Route[] = [
  {
    id: 'polar',
    title: 'Polar',
    link: `/`,
    icon: undefined,
    postIcon: <ArrowUpRightIcon className="h-4 w-4" />,
    if: true,
    subs: undefined,
  },
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
    id: 'faq',
    title: 'FAQ',
    link: '/docs/faq/for-maintainers',
    icon: undefined,
    postIcon: <ArrowUpRightIcon className="h-4 w-4" />,
    if: true,
    subs: undefined,
  },
  {
    id: 'docs',
    title: 'Docs',
    link: '/docs',
    icon: undefined,
    postIcon: <ArrowUpRightIcon className="h-4 w-4" />,
    if: true,
    subs: undefined,
  },
]
