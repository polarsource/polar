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
import SignalCellularAltOutlined from '@mui/icons-material/SignalCellularAltOutlined'
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined'
import TrendingDown from '@mui/icons-material/TrendingDown'
import { schemas } from '@polar-sh/client'
import { ReactNode } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Route, RouteWithActive, useResolveRoutes } from './navigation'

const billingRoutesList = (org?: schemas['Organization']): Route[] => [
  {
    id: 'products',
    title: 'Products',
    icon: <HiveOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/products`,
    checkIsActive: (path) =>
      path.startsWith(`/dashboard/${org?.slug}/products`),
    if: true,
    subs: [
      {
        title: 'Catalogue',
        link: `/dashboard/${org?.slug}/products`,
        icon: <HiveOutlined fontSize="inherit" />,
      },
      {
        title: 'Meters',
        link: `/dashboard/${org?.slug}/products/meters`,
        icon: <DonutLargeOutlined fontSize="inherit" />,
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

const insightsRoutesList = (org?: schemas['Organization']): Route[] => [
  {
    id: 'home',
    title: 'Home',
    icon: <SpaceDashboardOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}`,
    checkIsActive: (path) => path === `/dashboard/${org?.slug}`,
    if: true,
  },
  {
    id: 'compass',
    title: 'Compass',
    icon: <ExploreOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/compass`,
    checkIsActive: (path) => path.startsWith(`/dashboard/${org?.slug}/compass`),
    if: !!org?.feature_settings?.compass_enabled,
  },
  {
    id: 'metrics',
    title: 'Metrics',
    icon: <SignalCellularAltOutlined fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/analytics/metrics`,
    if: true,
  },
  {
    id: 'costs',
    title: 'Costs',
    icon: <TrendingDown fontSize="inherit" />,
    link: `/dashboard/${org?.slug}/analytics/costs`,
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

export const useInsightsRoutes = (
  org?: schemas['Organization'],
): RouteWithActive[] => useResolveRoutes(() => insightsRoutesList(org), org)

export const useProductNavigationEnabled = (
  org?: schemas['Organization'],
): boolean => !!org?.feature_settings?.compass_enabled
