import {
  DiamondOutlined,
  DiscountOutlined,
  DonutLargeOutlined,
  HistoryRounded,
  HiveOutlined,
  LinkOutlined,
} from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import { Route, RouteWithActive, useResolveRoutes } from './navigation'

const PRODUCT_SECTIONS = [
  'meters',
  'benefits',
  'checkout-links',
  'discounts',
  'versions',
] as const

const productSectionRoute = (
  org: schemas['Organization'] | undefined,
  section: (typeof PRODUCT_SECTIONS)[number],
  title: string,
  icon: React.ReactElement,
): Route => {
  const link = `/dashboard/${org?.slug}/products/${section}`
  return {
    id: section,
    title,
    icon,
    link,
    checkIsActive: (path) => path.startsWith(link),
    if: true,
  }
}

const discountRoutesList = (org?: schemas['Organization']): Route[] => [
  productSectionRoute(
    org,
    'discounts',
    'Discounts',
    <DiscountOutlined fontSize="inherit" />,
  ),
]

const catalogRoutesList = (org?: schemas['Organization']): Route[] => {
  const products = `/dashboard/${org?.slug}/products`
  return [
    {
      id: 'products',
      title: 'Products',
      icon: <HiveOutlined fontSize="inherit" />,
      link: products,
      checkIsActive: (path) =>
        path.startsWith(products) &&
        !PRODUCT_SECTIONS.some((section) =>
          path.startsWith(`${products}/${section}`),
        ),
      if: true,
    },
    productSectionRoute(
      org,
      'meters',
      'Meters',
      <DonutLargeOutlined fontSize="inherit" />,
    ),
    productSectionRoute(
      org,
      'benefits',
      'Benefits',
      <DiamondOutlined fontSize="inherit" />,
    ),
    productSectionRoute(
      org,
      'checkout-links',
      'Checkout Links',
      <LinkOutlined fontSize="inherit" />,
    ),
    productSectionRoute(
      org,
      'versions',
      'Versions',
      <HistoryRounded fontSize="inherit" />,
    ),
  ]
}

export const useDiscountRoutes = (
  org?: schemas['Organization'],
): RouteWithActive[] => useResolveRoutes(discountRoutesList, org)

export const useCatalogRoutes = (
  org?: schemas['Organization'],
): RouteWithActive[] => useResolveRoutes(catalogRoutesList, org)
