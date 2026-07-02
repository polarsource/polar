import { AppealCaseUnreadBadge } from '@/components/Organization/HumanReviewCase/AppealCaseUnreadBadge'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import AttachMoneyOutlined from '@mui/icons-material/AttachMoneyOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import DiamondOutlined from '@mui/icons-material/DiamondOutlined'
import DiscountOutlined from '@mui/icons-material/DiscountOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import ExploreOutlined from '@mui/icons-material/ExploreOutlined'
import GavelOutlined from '@mui/icons-material/GavelOutlined'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined'
import TrendingUp from '@mui/icons-material/TrendingUp'
import { schemas } from '@polar-sh/client'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Route, RouteWithActive, useResolveRoutes } from './navigation'

export type DashboardProduct = 'billing' | 'compass'

export type ProductMeta = {
  readonly id: DashboardProduct
  readonly label: string
  readonly icon: ReactNode
  readonly landing: (slug?: string) => string
}

export const DASHBOARD_PRODUCTS: readonly ProductMeta[] = [
  {
    id: 'compass',
    label: 'Compass',
    icon: <ExploreOutlined fontSize="inherit" />,
    landing: (slug) => `/dashboard/${slug}`,
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: <HiveOutlined fontSize="inherit" />,
    landing: (slug) => `/dashboard/${slug}/products`,
  },
]

const billingRoutesList = (org?: schemas['Organization']): Route[] => [
  {
    id: 'products',
    title: 'Products',
    icon: <HiveOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/products`,
    checkIsActive: (path) =>
      path.startsWith(`/dashboard/${org?.slug}/products`) &&
      !path.startsWith(`/dashboard/${org?.slug}/products/meters`),
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
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    icon: <ShoppingBagOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/sales`,
    checkIsActive: (path) => path.startsWith(`/dashboard/${org?.slug}/sales`),
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
  {
    id: 'finance',
    title: 'Finance',
    icon: <AttachMoneyOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/finance`,
    if: true,
    extra: org ? <AppealCaseUnreadBadge organization={org} /> : undefined,
    subs: [
      { title: 'Income', link: `/dashboard/${org?.slug}/finance/income` },
      { title: 'Payouts', link: `/dashboard/${org?.slug}/finance/payouts` },
      { title: 'Taxes', link: `/dashboard/${org?.slug}/finance/taxes` },
      {
        title: 'Account',
        link: `/dashboard/${org?.slug}/finance/account`,
        extra: org ? <AppealCaseUnreadBadge organization={org} /> : undefined,
      },
    ],
  },
]

const compassRoutesList = (org?: schemas['Organization']): Route[] => [
  {
    id: 'home',
    title: 'Home',
    icon: <SpaceDashboardOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}`,
    checkIsActive: (path) => path === `/dashboard/${org?.slug}`,
    if: true,
  },
  {
    id: 'metrics',
    title: 'Metrics',
    icon: <TrendingUp fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/analytics/metrics`,
    if: true,
  },
  {
    id: 'events',
    title: 'Events',
    icon: <BoltOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/analytics/events`,
    if: true,
  },
  {
    id: 'costs',
    title: 'Costs',
    icon: <AttachMoneyOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/analytics/costs`,
    if: true,
  },
  {
    id: 'meters',
    title: 'Meters',
    icon: <DonutLargeOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/products/meters`,
    if: true,
  },
]

const customersRoutesList = (org?: schemas['Organization']): Route[] => [
  {
    id: 'customers',
    title: 'Customers',
    icon: <PeopleAltOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/customers`,
    checkIsActive: (path) =>
      path.startsWith(`/dashboard/${org?.slug}/customers`),
    if: true,
  },
]

export const useBillingRoutes = (
  org?: schemas['Organization'],
): RouteWithActive[] => useResolveRoutes(() => billingRoutesList(org), org)

export const useCompassRoutes = (
  org?: schemas['Organization'],
): RouteWithActive[] => useResolveRoutes(() => compassRoutesList(org), org)

export const useCustomersRoutes = (
  org?: schemas['Organization'],
): RouteWithActive[] => useResolveRoutes(() => customersRoutesList(org), org)

export const useProductRoutes = (
  product: DashboardProduct,
  org?: schemas['Organization'],
): RouteWithActive[] => {
  const billing = useBillingRoutes(org)
  const compass = useCompassRoutes(org)
  return product === 'compass' ? compass : billing
}

export const useCurrentProduct = (
  org?: schemas['Organization'],
): DashboardProduct => {
  const path = usePathname()
  const base = `/dashboard/${org?.slug}`
  if (
    path === base ||
    path.startsWith(`${base}/analytics`) ||
    path.startsWith(`${base}/products/meters`)
  ) {
    return 'compass'
  }
  return 'billing'
}

export const useProductNavigationEnabled = (
  org?: schemas['Organization'],
): boolean => !!org?.feature_settings?.compass_enabled
