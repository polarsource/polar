'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { label: string; href: string }

const TOP_LEVEL: NavItem[] = [
  { label: 'Overview', href: '/' },
  { label: 'Metrics', href: '/metrics' },
  { label: 'Orders', href: '/orders' },
  { label: 'Products', href: '/products' },
  { label: 'Customers', href: '/customers' },
  { label: 'Finance', href: '/finance' },
  { label: 'Settings', href: '/settings' },
]

type SubNav = {
  label: string
  parentHref: string
  items: NavItem[]
}

const SUB_NAVS: { match: RegExp; nav: SubNav }[] = [
  {
    match: /^\/products(\/|$)/,
    nav: {
      label: 'Products',
      parentHref: '/',
      items: [
        { label: 'Catalogue', href: '/products' },
        { label: 'Benefits', href: '/products/benefits' },
        { label: 'Checkout Links', href: '/products/checkout-links' },
        { label: 'Discounts', href: '/products/discounts' },
        { label: 'Trials', href: '/products/trials' },
      ],
    },
  },
]

const findSubNav = (pathname: string) =>
  SUB_NAVS.find(({ match }) => match.test(pathname))?.nav

const isItemActive = (href: string, pathname: string) =>
  href === '/' ? pathname === '/' : pathname === href

const LINK_RESET = { textDecoration: 'none', color: 'inherit' } as const

export const Sidebar = () => {
  const pathname = usePathname()
  const subNav = findSubNav(pathname)

  return (
    <Box
      as="aside"
      flexShrink={0}
      display="flex"
      flexDirection="column"
      rowGap="3xl"
      paddingHorizontal="xl"
      paddingVertical="xl"
      position="sticky"
      minHeight={0}
      top={0}
    >
      <Box marginLeft="2xl">
        <Link href="/" style={LINK_RESET}>
          <Text variant="heading-xs" color="default">
            Polar
          </Text>
        </Link>
      </Box>

      <Box as="nav" display="flex" flexDirection="column" rowGap="m">
        {subNav ? (
          <SubNavView nav={subNav} pathname={pathname} />
        ) : (
          TOP_LEVEL.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              isActive={isItemActive(item.href, pathname)}
            />
          ))
        )}
      </Box>
    </Box>
  )
}

const SubNavView = ({ nav, pathname }: { nav: SubNav; pathname: string }) => (
  <Box display="flex" flexDirection="column" rowGap="xl">
    <Link href={nav.parentHref} style={LINK_RESET}>
      <Box display="flex" alignItems="center" columnGap="l">
        <Box display="flex" alignItems="center" justifyContent="center">
          <ArrowLeft size={14} strokeWidth={2} />
        </Box>
        <Text variant="heading-xs">{nav.label}</Text>
      </Box>
    </Link>

    <Box display="flex" flexDirection="column" rowGap="s">
      {nav.items.map((item) => (
        <NavRow
          key={item.href}
          item={item}
          isActive={isItemActive(item.href, pathname)}
        />
      ))}
    </Box>
  </Box>
)

const NavRow = ({ item, isActive }: { item: NavItem; isActive: boolean }) => (
  <Link href={item.href} style={LINK_RESET}>
    <Box display="flex" alignItems="center" columnGap="xl">
      <Box
        width={6}
        height={6}
        borderRadius="full"
        backgroundColor={isActive ? 'background-inverse' : 'background-card'}
        opacity={isActive ? 1 : 0}
      />
      <Text variant="heading-xs" color={isActive ? 'default' : 'muted'}>
        {item.label}
      </Text>
    </Box>
  </Link>
)
