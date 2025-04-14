import { PolarHog, usePostHog } from '@/hooks/posthog'
import {
  AllInclusiveOutlined,
  AttachMoneyOutlined,
  AutoAwesome,
  BadgeOutlined,
  CodeOutlined,
  DiscountOutlined,
  DonutLargeOutlined,
  HiveOutlined,
  HowToVote,
  LinkOutlined,
  ModeStandby,
  PeopleOutlined,
  ShoppingBagOutlined,
  SpaceDashboardOutlined,
  Storefront,
  StreamOutlined,
  TrendingUp,
  TuneOutlined,
} from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
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
  parentRoute?: Route,
): ((r: SubRoute) => SubRouteWithActive) => {
  return (r: SubRoute): SubRouteWithActive => {
    const isActive =
      r.link === path ||
      (parentRoute?.link !== r.link && path.startsWith(r.link))
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

    const subs = r.subs ? r.subs.map(applySubRouteIsActive(path, r)) : undefined

    return {
      ...r,
      isActive,
      subs,
    }
  }
}

const useResolveRoutes = (
  routesResolver: (org: schemas['Organization'], posthog?: PolarHog) => Route[],
  org: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  const path = usePathname()
  const posthog = usePostHog()

  return useMemo(() => {
    return routesResolver(org, posthog)
      .filter((o) => allowAll || o.if)
      .map(applyIsActive(path))
  }, [org, path, allowAll, routesResolver, posthog])
}

export const useDashboardRoutes = (
  org: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  const posthog = usePostHog()

  return useResolveRoutes(
    (org) => dashboardRoutesList(org, posthog),
    org,
    allowAll,
  )
}

export const useGeneralRoutes = (
  org: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  const posthog = usePostHog()

  return useResolveRoutes(
    (org) => generalRoutesList(org, posthog),
    org,
    allowAll,
  )
}

export const useFundingRoutes = (
  org: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes(fundingRoutesList, org, allowAll)
}

export const useOrganizationRoutes = (
  org: schemas['Organization'],
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
  org: schemas['Organization'],
  posthog: PolarHog,
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
    id: 'new-products',
    title: 'Products',
    icon: <HiveOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/products`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/products`)
    },
    if: true,
    subs: [
      {
        title: 'Catalogue',
        link: `/dashboard/${org.slug}/products`,
        icon: <HiveOutlined fontSize="inherit" />,
      },
      {
        title: 'Checkout Links',
        link: `/dashboard/${org.slug}/products/checkout-links`,
        icon: <LinkOutlined fontSize="inherit" />,
      },
      {
        title: 'Discounts',
        link: `/dashboard/${org.slug}/products/discounts`,
        icon: <DiscountOutlined fontSize="inherit" />,
      },
    ],
  },
  {
    id: 'benefits',
    title: 'Benefits',
    icon: <AutoAwesome fontSize="inherit" />,
    link: `/dashboard/${org.slug}/benefits`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/benefits`)
    },
    if: true,
  },
  {
    id: 'usage-billing',
    title: 'Usage Billing',
    icon: <DonutLargeOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/usage-billing/meters`,
    if: posthog?.isFeatureEnabled('usage_based_billing'),
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/usage-billing`)
    },
    subs: [
      {
        title: 'Meters',
        link: `/dashboard/${org.slug}/usage-billing/meters`,
        icon: <DonutLargeOutlined fontSize="inherit" />,
      },
      {
        title: 'Events',
        link: `/dashboard/${org.slug}/usage-billing/events`,
        icon: <StreamOutlined fontSize="inherit" />,
      },
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: <PeopleOutlined fontSize="inherit" />,
    link: `/dashboard/${org.slug}/customers`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/customers`)
    },
    if: true,
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
        icon: <ShoppingBagOutlined fontSize="inherit" />,
      },
      {
        title: 'Subscriptions',
        link: `/dashboard/${org.slug}/sales/subscriptions`,
        icon: <AllInclusiveOutlined fontSize="inherit" />,
      },
    ],
  },
  {
    id: 'storefront',
    title: 'Storefront',
    icon: <Storefront fontSize="inherit" />,
    link: `/dashboard/${org.slug}/storefront`,
    if: org.profile_settings?.enabled ?? false,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: <TrendingUp fontSize="inherit" />,
    link: `/dashboard/${org.slug}/analytics`,
    if: true,
  },
]

const fundingRoutesList = (org: schemas['Organization']): Route[] => [
  {
    id: 'org-issues',
    title: 'Issues',
    icon: <ModeStandby fontSize="inherit" />,
    link: `/dashboard/${org.slug}/issues/overview`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org.slug}/issues`)
    },
    if: org.feature_settings?.issue_funding_enabled,
    subs: [
      {
        title: 'Overview',
        link: `/dashboard/${org.slug}/issues/overview`,
        icon: <ModeStandby fontSize="inherit" />,
      },
      {
        title: 'Badge',
        link: `/dashboard/${org.slug}/issues/badge`,
        icon: <BadgeOutlined fontSize="inherit" />,
      },
      {
        title: 'Embeds',
        link: `/dashboard/${org.slug}/issues/embed`,
        icon: <CodeOutlined fontSize="inherit" />,
      },
      {
        title: 'Organizations',
        link: `/dashboard/${org.slug}/issues/organizations`,
        icon: <PeopleOutlined fontSize="inherit" />,
      },
    ],
  },
]

const dashboardRoutesList = (
  org: schemas['Organization'],
  posthog: PolarHog,
): Route[] => [
  ...generalRoutesList(org, posthog),
  ...fundingRoutesList(org),
  ...organizationRoutesList(org),
]

const backerRoutesList = (): Route[] => [
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

const orgFinanceSubRoutesList = (org: schemas['Organization']): SubRoute[] => [
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

const organizationRoutesList = (org: schemas['Organization']): Route[] => [
  {
    id: 'finance',
    title: 'Finance',
    link: `/dashboard/${org.slug}/finance`,
    icon: <AttachMoneyOutlined fontSize="inherit" />,
    if: true,
    subs: orgFinanceSubRoutesList(org),
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/dashboard/${org.slug}/settings`,
    icon: <TuneOutlined fontSize="inherit" />,
    if: true,
    subs: [
      {
        title: 'General',
        link: `/dashboard/${org.slug}/settings`,
      },
      {
        title: 'Webhooks',
        link: `/dashboard/${org.slug}/settings/webhooks`,
      },
      {
        title: 'Custom Fields',
        link: `/dashboard/${org.slug}/settings/custom-fields`,
      },
    ],
  },
]
