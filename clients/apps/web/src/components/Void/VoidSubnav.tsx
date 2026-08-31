'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface VoidSubnavItem {
  label: string
  href: string
  exact?: boolean
}

export const usageSubnavItems = (
  organizationSlug: string,
): VoidSubnavItem[] => {
  const base = `/dashboard/${organizationSlug}/void/usage`
  return [
    { label: 'Events', href: base, exact: true },
    { label: 'Meters', href: `${base}/meters` },
    { label: 'Identities', href: `${base}/identities` },
  ]
}

export const billingSubnavItems = (
  organizationSlug: string,
): VoidSubnavItem[] => {
  const base = `/dashboard/${organizationSlug}/void/billing`
  return [
    { label: 'Definition', href: base, exact: true },
    { label: 'Products', href: `${base}/products` },
    { label: 'Subscriptions', href: `${base}/subscriptions` },
    { label: 'Orders', href: `${base}/orders` },
    { label: 'Checkouts', href: `${base}/checkouts` },
  ]
}

export const settingsSubnavItems = (
  organizationSlug: string,
): VoidSubnavItem[] => {
  const base = `/dashboard/${organizationSlug}/void/settings`
  return [
    { label: 'General', href: base, exact: true },
    { label: 'Members', href: `${base}/members` },
    { label: 'Webhooks', href: `${base}/webhooks` },
    { label: 'Developers', href: `${base}/developers` },
  ]
}

export const VoidSubnav = ({ items }: { items: VoidSubnavItem[] }) => {
  const pathname = usePathname()

  return (
    <Box columnGap="2xl" rowGap="s" flexWrap="wrap">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href}>
            <Box flexDirection="column" rowGap="xs">
              <Text variant="heading-xxs" color={active ? 'default' : 'muted'}>
                {item.label}
              </Text>
              <Box
                height={1}
                backgroundColor={active ? 'background-inverse' : undefined}
              />
            </Box>
          </Link>
        )
      })}
    </Box>
  )
}
