import { AppealCaseUnreadBadge } from '@/components/Organization/HumanReviewCase/AppealCaseUnreadBadge'
import { useHasPermission } from '@/hooks/permissions'
import { PolarHog, usePostHog } from '@/hooks/posthog'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import AttachMoneyOutlined from '@mui/icons-material/AttachMoneyOutlined'
import CodeOutlined from '@mui/icons-material/CodeOutlined'
import DiamondOutlined from '@mui/icons-material/DiamondOutlined'
import DiscountOutlined from '@mui/icons-material/DiscountOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import GavelOutlined from '@mui/icons-material/GavelOutlined'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined'
import TrendingUp from '@mui/icons-material/TrendingUp'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import { schemas } from '@polar-sh/client'
import { ShoppingCart } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

export type SubRoute = {
  readonly title: string
  readonly link: string
  readonly icon?: React.ReactNode
  readonly if?: boolean | (() => boolean)
  readonly extra?: React.ReactNode
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
  readonly extra?: React.ReactNode
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
    let isActive = r.link === path

    if (!isActive && path.startsWith(r.link)) {
      if (parentRoute?.link !== r.link) {
        isActive = true
      } else if (parentRoute.subs) {
        const hasMoreSpecificMatch = parentRoute.subs.some(
          (sub) =>
            sub !== r && sub.link !== r.link && path.startsWith(sub.link),
        )
        isActive = !hasMoreSpecificMatch
      }
    }

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
    return (
      routesResolver(org, posthog)
        .filter((o) => allowAll || o.if)
        // Filter out child routes if they have an if-function and it evaluates to false
        .map((route) => {
          if (route.subs && Array.isArray(route.subs)) {
            return {
              ...route,
              subs: route.subs.filter(
                (child) =>
                  typeof child.if === 'undefined' ||
                  (typeof child.if === 'function' ? child.if() : child.if),
              ),
            }
          }
          return route
        })
        .map(applyIsActive(path))
    )
  }, [org, path, allowAll, routesResolver, posthog])
}

type RouteOptions = {
  canManageBilling: boolean
}

const useRouteOptions = (org?: schemas['Organization']): RouteOptions => {
  const canManageBilling =
    useHasPermission(org?.id, 'organization:manage') === true
  return { canManageBilling }
}

export const useDashboardRoutes = (
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  const options = useRouteOptions(org)
  return useResolveRoutes(
    (org) => dashboardRoutesList(org, options),
    org,
    allowAll,
  )
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
  const options = useRouteOptions(org)
  return useResolveRoutes(
    (org) => organizationRoutesList(org, options),
    org,
    allowAll,
  )
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
      {
        title: 'Benefits',
        link: `/dashboard/${org?.slug}/products/benefits`,
        icon: <DiamondOutlined fontSize="inherit" />,
      },
      {
        title: 'Meters',
        link: `/dashboard/${org?.slug}/products/meters`,
        icon: <DonutLargeOutlined fontSize="inherit" />,
      },
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: <PeopleAltOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/customers`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/customers`)
    },
    if: true,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: <TrendingUp fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/analytics`,
    if: true,
    subs: [
      {
        title: 'Metrics',
        link: `/dashboard/${org?.slug}/analytics/metrics`,
      },
      {
        title: 'Events',
        link: `/dashboard/${org?.slug}/analytics/events`,
      },
      {
        title: 'Costs',
        link: `/dashboard/${org?.slug}/analytics/costs`,
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
      {
        title: 'Disputes',
        link: `/dashboard/${org?.slug}/sales/disputes`,
        icon: <GavelOutlined fontSize="inherit" />,
        if: !!org?.feature_settings?.disputes_enabled,
      },
    ],
  },
]

const dashboardRoutesList = (
  org: schemas['Organization'] | undefined,
  options: RouteOptions,
): Route[] => [
  ...accountRoutesList(),
  ...generalRoutesList(org),
  ...organizationRoutesList(org, options),
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
    title: 'Taxes',
    link: `/dashboard/${org?.slug}/finance/taxes`,
  },
  {
    title: 'Account',
    link: `/dashboard/${org?.slug}/finance/account`,
    extra: org ? <AppealCaseUnreadBadge organization={org} /> : undefined,
  },
]

const organizationRoutesList = (
  org: schemas['Organization'] | undefined,
  options: RouteOptions,
): Route[] => [
  {
    id: 'finance',
    title: 'Finance',
    link: `/dashboard/${org?.slug}/finance`,
    icon: <AttachMoneyOutlined fontSize="inherit" />,
    if: true,
    subs: orgFinanceSubRoutesList(org),
    extra: org ? <AppealCaseUnreadBadge organization={org} /> : undefined,
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/dashboard/${org?.slug}/settings`,
    icon: <TuneOutlined fontSize="inherit" />,
    if: true,
    subs: [
      {
        title: 'Preferences',
        link: `/dashboard/${org?.slug}/settings`,
      },
      {
        title: 'Billing',
        link: `/dashboard/${org?.slug}/settings/billing`,
        if: options.canManageBilling,
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
      {
        title: 'Single Sign-On',
        link: `/dashboard/${org?.slug}/settings/sso`,
        if: !!org?.feature_settings?.sso_enabled,
      },
    ],
  },
]
