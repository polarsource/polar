'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/' },
  { label: 'Metrics', href: '/metrics' },
  { label: 'Orders', href: '/orders' },
  { label: 'Products', href: '/products' },
  { label: 'Finance', href: '/finance' },
  { label: 'Settings', href: '/settings' },
]

const isHrefActive = (href: string, pathname: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href)

export const Sidebar = () => {
  const pathname = usePathname()

  return (
    <Box
      as="aside"
      width={232}
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
      <Box marginLeft="xl">
        <Link
          href="/"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Text variant="heading-xs" color="default">
            Polar
          </Text>
        </Link>
      </Box>

      <Box as="nav" display="flex" flexDirection="column" rowGap="s">
        {navItems.map((item) => {
          const isActive = isHrefActive(item.href, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Box display="flex" alignItems="center" columnGap="l">
                <Box
                  width={6}
                  height={6}
                  borderRadius="full"
                  backgroundColor={
                    isActive ? 'background-inverse' : 'background-card'
                  }
                  opacity={isActive ? 1 : 0}
                />
                <Text
                  variant="heading-xs"
                  color={isActive ? 'default' : 'muted'}
                >
                  {item.label}
                </Text>
              </Box>
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}
