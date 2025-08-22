import { PolarHog, usePostHog } from '@/hooks/posthog'
import {
  AllInclusiveOutlined,
  AttachMoneyOutlined,
  CodeOutlined,
  DiamondOutlined,
  DiscountOutlined,
  DonutLargeOutlined,
  HiveOutlined,
  LinkOutlined,
  ShoppingBagOutlined,
  SpaceDashboardOutlined,
  Storefront,
  StreamOutlined,
  TrendingUp,
  TuneOutlined,
} from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import { Brain, ShoppingCart } from 'lucide-react'
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
  routesResolver: (
    org?: schemas['Organization'],
    posthog?: PolarHog,
  ) => Route[],
  org?: schemas['Organization'],
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
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes((org) => dashboardRoutesList(org), org, allowAll)
}

export const useGeneralRoutes = (
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes((org) => generalRoutesList(org), org, allowAll)
}

export const useOrganizationRoutes = (
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes(organizationRoutesList, org, allowAll)
}

export const useAccountRoutes = (): RouteWithActive[] => {
  const path = usePathname()
  return accountRoutesList()
    .filter((o) => o.if)
    .map(applyIsActive(path))
}

// internals below

const generalRoutesList = (org?: schemas['Organization']): Route[] => [
  {
    id: 'home',
    title: 'Home',
    icon: <SpaceDashboardOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}`,
    checkIsActive: (currentRoute: string) =>
      currentRoute === `/dashboard/${org?.slug}`,
    if: true,
  },
  {
    id: 'new-products',
    title: 'Products',
    icon: <HiveOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/products`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/products`)
    },
    if: true,
    subs: [
      {
        title: 'Catalogue',
        link: `/dashboard/${org?.slug}/products`,
        icon: <HiveOutlined fontSize="inherit" />,
      },
      {
        title: 'Checkout Links',
        link: `/dashboard/${org?.slug}/products/checkout-links`,
        icon: <LinkOutlined fontSize="inherit" />,
      },
      {
        title: 'Discounts',
        link: `/dashboard/${org?.slug}/products/discounts`,
        icon: <DiscountOutlined fontSize="inherit" />,
      },
    ],
  },
  {
    id: 'usage-billing',
    title: 'Usage Billing',
    icon: <DonutLargeOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/usage-billing`,
    if: true,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/usage-billing`)
    },
    subs: [
      {
        title: 'Meters',
        link: `/dashboard/${org?.slug}/usage-billing/meters`,
        icon: <DonutLargeOutlined fontSize="inherit" />,
      },
      {
        title: 'Events',
        link: `/dashboard/${org?.slug}/usage-billing/events`,
        icon: <StreamOutlined fontSize="inherit" />,
      },
    ],
  },
  {
    id: 'benefits',
    title: 'Benefits',
    icon: <DiamondOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/benefits`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/benefits`)
    },
    if: true,
  },
  {
    id: 'gateway',
    title: 'Gateway',
    icon: <Brain size={15} />,
    link: `/dashboard/${org?.slug}/gateway`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/gateway`)
    },
    if: true,
    subs: [
      {
        title: 'Overview',
        link: `/dashboard/${org?.slug}/gateway/overview`,
      },
      {
        title: 'Usage',
        link: `/dashboard/${org?.slug}/gateway/usage`,
      },
      {
        title: 'Providers',
        link: `/dashboard/${org?.slug}/gateway/providers`,
      },
    ],
  },
  {
    id: 'org-sales',
    title: 'Sales',
    icon: <ShoppingBagOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/sales`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/sales`)
    },
    if: true,
    subs: [
      {
        title: 'Orders',
        link: `/dashboard/${org?.slug}/sales`,
        icon: <ShoppingBagOutlined fontSize="inherit" />,
      },
      {
        title: 'Subscriptions',
        link: `/dashboard/${org?.slug}/sales/subscriptions`,
        icon: <AllInclusiveOutlined fontSize="inherit" />,
      },
      {
        title: 'Checkouts',
        link: `/dashboard/${org?.slug}/sales/checkouts`,
        icon: <ShoppingCart />,
      },
    ],
  },
  {
    id: 'storefront',
    title: 'Storefront',
    icon: <Storefront fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/storefront`,
    if: false,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: <TrendingUp fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/analytics`,
    if: true,
  },
]

const dashboardRoutesList = (org?: schemas['Organization']): Route[] => [
  ...accountRoutesList(),
  ...generalRoutesList(org),
  ...organizationRoutesList(org),
]

const accountRoutesList = (): Route[] => [
  {
    id: 'preferences',
    title: 'Preferences',
    link: `/dashboard/account/preferences`,
    icon: <TuneOutlined className="h-5 w-5" fontSize="inherit" />,
    if: true,
    subs: undefined,
  },
  {
    id: 'developer',
    title: 'Developer',
    link: `/dashboard/account/developer`,
    icon: <CodeOutlined fontSize="inherit" />,
    if: true,
  },
]

const orgFinanceSubRoutesList = (org?: schemas['Organization']): SubRoute[] => [
  {
    title: 'Income',
    link: `/dashboard/${org?.slug}/finance/income`,
  },
  {
    title: 'Payouts',
    link: `/dashboard/${org?.slug}/finance/payouts`,
  },
  {
    title: 'Account',
    link: `/dashboard/${org?.slug}/finance/account`,
  },
]

const organizationRoutesList = (org?: schemas['Organization']): Route[] => [
  {
    id: 'finance',
    title: 'Finance',
    link: `/dashboard/${org?.slug}/finance`,
    icon: <AttachMoneyOutlined fontSize="inherit" />,
    if: true,
    subs: orgFinanceSubRoutesList(org),
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/dashboard/${org?.slug}/settings`,
    icon: <TuneOutlined fontSize="inherit" />,
    if: true,
    subs: [
      {
        title: 'General',
        link: `/dashboard/${org?.slug}/settings`,
      },
      {
        title: 'Members',
        link: `/dashboard/${org?.slug}/settings/members`,
      },
      {
        title: 'Webhooks',
        link: `/dashboard/${org?.slug}/settings/webhooks`,
      },
      {
        title: 'Custom Fields',
        link: `/dashboard/${org?.slug}/settings/custom-fields`,
      },
    ],
  },
]
