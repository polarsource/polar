import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import FunctionsOutlined from '@mui/icons-material/FunctionsOutlined'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import SignalCellularAltOutlined from '@mui/icons-material/SignalCellularAltOutlined'
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined'
import { schemas } from '@polar-sh/client'
import { usePathname } from 'next/navigation'
import { Route, RouteWithActive, useResolveRoutes } from './navigation'

const voidDashboardPath = (slug?: string) => `/void/dashboard/${slug}`

const voidRoutesList = (org?: schemas['Organization']): Route[] => {
  const base = voidDashboardPath(org?.slug)
  return [
    {
      id: 'void-home',
      title: 'Home',
      icon: <SpaceDashboardOutlined fontSize="inherit" />,
      link: base,
      checkIsActive: (path) => path === base,
      if: true,
    },
    {
      id: 'void-definition',
      title: 'Definition',
      icon: <HiveOutlined fontSize="inherit" />,
      link: `${base}/definition`,
      if: true,
      subs: [
        {
          title: 'Products',
          link: `${base}/definition/products`,
          icon: <HiveOutlined fontSize="inherit" />,
        },
        {
          title: 'Events',
          link: `${base}/definition/events`,
          icon: <BoltOutlined fontSize="inherit" />,
        },
        {
          title: 'Reducers',
          link: `${base}/definition/reducers`,
          icon: <FunctionsOutlined fontSize="inherit" />,
        },
        {
          title: 'Meters',
          link: `${base}/definition/meters`,
          icon: <DonutLargeOutlined fontSize="inherit" />,
        },
      ],
    },
    {
      id: 'void-identities',
      title: 'Identities',
      icon: <PeopleAltOutlined fontSize="inherit" />,
      link: `${base}/identities`,
      if: true,
    },
    {
      id: 'void-billing',
      title: 'Billing',
      icon: <ShoppingBagOutlined fontSize="inherit" />,
      link: `${base}/billing`,
      if: true,
      subs: [
        {
          title: 'Subscriptions',
          link: `${base}/billing/subscriptions`,
          icon: <AllInclusiveOutlined fontSize="inherit" />,
        },
        {
          title: 'Orders',
          link: `${base}/billing/orders`,
          icon: <ShoppingBagOutlined fontSize="inherit" />,
        },
      ],
    },
    {
      id: 'void-metrics',
      title: 'Metrics',
      icon: <SignalCellularAltOutlined fontSize="inherit" />,
      link: `${base}/metrics`,
      if: true,
    },
  ]
}

export const useVoidRoutes = (
  org?: schemas['Organization'],
): RouteWithActive[] => useResolveRoutes(() => voidRoutesList(org), org)

export const useIsVoidDestination = (): boolean =>
  usePathname().startsWith('/void/dashboard/')
