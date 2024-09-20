import { Organization } from '@polar-sh/sdk'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  AttachMoneyOutlined,
  DiamondOutlined,
  DonutLargeOutlined,
  DraftsOutlined,
  HiveOutlined,
  HowToVote,
  LooksOutlined,
  ModeStandby,
  ShoppingBagOutlined,
  SpaceDashboardOutlined,
  SpokeOutlined,
  TrendingUp,
  TuneOutlined,
  Webhook,
  WifiTetheringOutlined,
} from '@mui/icons-material'
import { usePathname } from 'next/navigation'
import { useContext, useMemo } from 'react'

export type SubRoute = {
  readonly title: string
  readonly link: string
  readonly icon?: React.ReactNode
}

export type Route = {
  readonly id: string
  readonly title: string
  readonly icon?: React.ReactElement
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

const useResolveRoutes = (
  routesResolver: (org: Organization, onboardingCompleted: boolean) => Route[],
  org: Organization,
  allowAll?: boolean,
): RouteWithActive[] => {
  const path = usePathname()
  const { onboarding } = useContext(MaintainerOrganizationContext)

  return useMemo(() => {
    return routesResolver(org, onboarding.completed)
      .filter((o) => allowAll || o.if)
      .map(applyIsActive(path))
  }, [org, path, allowAll, routesResolver, onboarding])
}

export const useDashboardRoutes = (
  org: Organization,
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes(dashboardRoutesList, org, allowAll)
}

export const useGeneralRoutes = (
  org: Organization,
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes(generalRoutesList, org, allowAll)
}

export const useFundingRoutes = (
  org: Organization,
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes(fundingRoutesList, org, allowAll)
}

export const useCommunityRoutes = (
  org: Organization,
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes(communityRoutesList, org, allowAll)
}

export const useOrganizationRoutes = (
  org: Organization,
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes(organizationRoutesList, org, allowAll)
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

const generalRoutesList = (
  org: Organization,
  onboardingCompleted: boolean,
): Route[] => [
  {
    id: 'home',
    title: 'Home',
    icon: <SpaceDashboardOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}`,
    checkIsActive: (currentRoute: string) =>
      currentRoute === `/dashboard/${org.slug}`,
    if: true,
  },
  {
    id: 'products',
    title: 'Products',
    icon: <HiveOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/products`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/products`)
    },
    if: true,
    subs: [
      {
        title: 'Catalog',
        link: `/dashboard/${org.slug}/products`,
      },
      {
        title: 'Benefits',
        link: `/dashboard/${org.slug}/products/benefits`,
      },
    ],
  },
  {
    id: 'org-sales',
    title: 'Sales',
    icon: <ShoppingBagOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/sales`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/sales`)
    },
    if: true,
    subs: [
      {
        title: 'Orders',
        link: `/dashboard/${org.slug}/sales`,
      },
      {
        title: 'Subscriptions',
        link: `/dashboard/${org.slug}/sales/subscriptions`,
      },
    ],
  },
  {
    id: 'customize',
    title: 'Customize',
    icon: <LooksOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/customize`,
    if: true,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: <TrendingUp fontSize="inherit" />,
    link: `/dashboard/${org.slug}/analytics`,
    if: true,
  },
  {
    id: 'onboarding',
    title: 'Onboarding',
    icon: <DonutLargeOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/onboarding`,
    if: !onboardingCompleted,
  },
]

const fundingRoutesList = (org: Organization): Route[] => [
  {
    id: 'org-issues',
    title: 'Issues',
    icon: <ModeStandby fontSize="inherit" />,
    link: `/dashboard/${org.slug}/issues/overview`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/issues`)
    },
    if: true,
    subs: [
      {
        title: 'Overview',
        link: `/dashboard/${org.slug}/issues/overview`,
      },
      {
        title: 'Badge',
        link: `/dashboard/${org.slug}/issues/badge`,
      },
      {
        title: 'Organizations',
        link: `/dashboard/${org.slug}/issues/organizations`,
      },
    ],
  },
  {
    id: 'donations',
    title: 'Donations',
    icon: <SpokeOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/donations/overview`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/donations`)
    },
    if: true,
  },
  {
    id: 'promote',
    title: 'Promote',
    icon: <WifiTetheringOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/promote`,
    if: true,
    subs: undefined,
  },
]

const communityRoutesList = (org: Organization): Route[] => [
  {
    id: 'newsletter',
    title: 'Newsletter',
    icon: <DraftsOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/posts`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/posts`)
    },
    if: !!org.feature_settings?.articles_enabled ?? false,
  },
]

const dashboardRoutesList = (
  org: Organization,
  onboardingCompleted: boolean,
): Route[] => [
  ...generalRoutesList(org, onboardingCompleted),
  ...fundingRoutesList(org),
  ...communityRoutesList(org),
  ...organizationRoutesList(org),
]

const backerRoutesList = (): Route[] => [
  {
    id: 'purchases',
    title: 'Purchases',
    link: `/purchases`,
    icon: <DiamondOutlined className="h-5 w-5" fontSize="inherit" />,
    if: true,
    subs: undefined,
  },
  {
    id: 'funding',
    title: 'Funded Issues',
    link: `/funding`,
    icon: <HowToVote className="h-5 w-5" fontSize="inherit" />,
    if: true,
    subs: undefined,
  },
  {
    id: 'finance',
    title: 'Finance',
    link: `/finance`,
    icon: <AttachMoneyOutlined className="h-5 w-5" fontSize="inherit" />,
    if: true,
    subs: personalFinanceSubRoutesList(),
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/settings`,
    icon: <TuneOutlined className="h-5 w-5" fontSize="inherit" />,
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
    link: `/dashboard/${org.slug}/finance/incoming`,
  },
  {
    title: 'Outgoing',
    link: `/dashboard/${org.slug}/finance/outgoing`,
  },
  {
    title: 'Issue Funding',
    link: `/dashboard/${org.slug}/finance/issue-funding`,
  },

  {
    title: 'Payout Account',
    link: `/dashboard/${org.slug}/finance/account`,
  },
]

const organizationRoutesList = (org: Organization): Route[] => [
  {
    id: 'finance',
    title: 'Finance',
    link: `/dashboard/${org.slug}/finance`,
    icon: <AttachMoneyOutlined className="h-5 w-5" fontSize="inherit" />,
    if: true,
    subs: orgFinanceSubRoutesList(org),
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/dashboard/${org.slug}/settings`,
    icon: <TuneOutlined className="h-5 w-5" fontSize="inherit" />,
    if: true,
    subs: undefined,
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    icon: <Webhook fontSize="inherit" />,
    link: `/dashboard/${org.slug}/webhooks`,
    if: false,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/settings/webhooks`)
    },
  },
]
