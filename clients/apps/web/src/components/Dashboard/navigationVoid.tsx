import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import AltRouteOutlined from '@mui/icons-material/AltRouteOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import ExploreOutlined from '@mui/icons-material/ExploreOutlined'
import FunctionsOutlined from '@mui/icons-material/FunctionsOutlined'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined'
import SensorsOutlined from '@mui/icons-material/SensorsOutlined'
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
      id: 'void-compass',
      title: 'Compass',
      icon: <ExploreOutlined fontSize="inherit" />,
      link: `${base}/compass`,
      if: !!org?.feature_settings?.compass_enabled,
    },
    {
      id: 'void-events',
      title: 'Events',
      icon: <BoltOutlined fontSize="inherit" />,
      link: `${base}/events/stream`,
      checkIsActive: (path) => path.startsWith(`${base}/events`),
      if: true,
      subs: [
        {
          title: 'Stream',
          link: `${base}/events/stream`,
          icon: <BoltOutlined fontSize="inherit" />,
        },
        {
          title: 'Reducers',
          link: `${base}/events/reducers`,
          icon: <FunctionsOutlined fontSize="inherit" />,
        },
        {
          title: 'Signals',
          link: `${base}/events/signals`,
          icon: <SensorsOutlined fontSize="inherit" />,
        },
      ],
    },
    {
      id: 'void-simulate',
      title: 'Simulate',
      icon: <AltRouteOutlined fontSize="inherit" />,
      link: `${base}/simulate`,
      if: true,
    },
    {
      id: 'void-identities',
      title: 'Identities',
      icon: <PeopleAltOutlined fontSize="inherit" />,
      link: `${base}/identities`,
      if: true,
    },
    {
      id: 'void-metrics',
      title: 'Metrics',
      icon: <SignalCellularAltOutlined fontSize="inherit" />,
      link: `${base}/metrics`,
      if: true,
    },
    {
      id: 'void-billing',
      title: 'Billing',
      icon: <ShoppingBagOutlined fontSize="inherit" />,
      link: `${base}/billing/products`,
      checkIsActive: (path) => path.startsWith(`${base}/billing`),
      if: true,
      subs: [
        {
          title: 'Products',
          link: `${base}/billing/products`,
          icon: <HiveOutlined fontSize="inherit" />,
        },
        {
          title: 'Meters',
          link: `${base}/billing/meters`,
          icon: <DonutLargeOutlined fontSize="inherit" />,
        },
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
  ]
}

export const useVoidRoutes = (
  org?: schemas['Organization'],
): RouteWithActive[] => useResolveRoutes(() => voidRoutesList(org), org)

export const useIsVoidDestination = (): boolean =>
  usePathname().startsWith('/void/dashboard/')
