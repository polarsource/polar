'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  VoidSubnavItem,
  billingSubnavItems,
  settingsSubnavItems,
  usageSubnavItems,
} from './VoidSubnav'

export const VoidHeader = ({
  organizationName,
  organizationSlug,
}: {
  organizationName: string
  organizationSlug: string
}) => {
  const [searchOpen, setSearchOpen] = useState(false)
  const pathname = usePathname()

  const base = `/dashboard/${organizationSlug}/void`
  const nav = [
    { index: '01', label: 'Home', href: base },
    { index: '02', label: 'Usage', href: `${base}/usage` },
    { index: '03', label: 'Billing', href: `${base}/billing` },
    { index: '04', label: 'Metrics', href: `${base}/metrics` },
    { index: '05', label: 'Settings', href: `${base}/settings` },
  ]

  useEffect(() => {
    document.body.style.overflow = searchOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [searchOpen])

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href)

  const subnav: VoidSubnavItem[] | null = pathname.startsWith(`${base}/usage`)
    ? usageSubnavItems(organizationSlug)
    : pathname.startsWith(`${base}/billing`)
      ? billingSubnavItems(organizationSlug)
      : pathname.startsWith(`${base}/settings`)
        ? settingsSubnavItems(organizationSlug)
        : null

  const isSubActive = (item: VoidSubnavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <Box
      as="header"
      flexDirection="column"
      rowGap="3xl"
      alignSelf="start"
      position={{ lg: 'sticky' }}
      top={{ lg: 0 }}
      paddingTop="xl"
      paddingBottom="2xl"
    >
      <Box alignItems="start" flexDirection="column">
        <Text variant="heading-s" as="h1" color="muted">
          Polar
        </Text>
        <Link href={base}>
          <Text variant="heading-s" as="h1">
            {organizationName}
          </Text>
        </Link>
      </Box>
      <Box as="nav" flexDirection="column" rowGap="s">
        {nav.map((item) => (
          <Box key={item.index} flexDirection="column" rowGap="s">
            <Link href={item.href}>
              <Box
                alignItems="baseline"
                columnGap="l"
                color={{ base: 'text-primary', hover: 'text-tertiary' }}
                transitionProperty="colors"
                transitionDuration="fast"
                ease="decelerate"
              >
                <Box width={28}>
                  <Text
                    variant="heading-xs"
                    color={isActive(item.href) ? 'default' : 'muted'}
                  >
                    {isActive(item.href) ? '—' : item.index}
                  </Text>
                </Box>
                <Text variant="heading-xs" color="inherit">
                  {item.label}
                </Text>
              </Box>
            </Link>
            {subnav && isActive(item.href) ? (
              <Box columnGap="l">
                <Box width={28} flexShrink={0} />
                <Box as="nav" flexDirection="column" rowGap="s">
                  {subnav.map((subItem) => (
                    <Link key={subItem.href} href={subItem.href}>
                      <Box
                        color={{
                          base: isSubActive(subItem)
                            ? 'text-primary'
                            : 'text-tertiary',
                          hover: isSubActive(subItem)
                            ? 'text-tertiary'
                            : 'text-primary',
                        }}
                        transitionProperty="colors"
                        transitionDuration="fast"
                        ease="decelerate"
                      >
                        <Text variant="heading-xs" color="inherit">
                          {subItem.label}
                        </Text>
                      </Box>
                    </Link>
                  ))}
                </Box>
              </Box>
            ) : null}
          </Box>
        ))}
      </Box>
      <button
        type="button"
        aria-label="Search"
        aria-expanded={searchOpen}
        onClick={() => setSearchOpen((open) => !open)}
        className="cursor-pointer self-start border-0 bg-transparent p-0"
      >
        <Box
          color={{ base: 'text-primary', hover: 'text-tertiary' }}
          transitionProperty="colors"
          transitionDuration="fast"
          ease="decelerate"
        >
          <Search size={28} strokeWidth={1.5} />
        </Box>
      </button>
      {searchOpen
        ? createPortal(
            <Box
              position="fixed"
              top={0}
              left={0}
              right={0}
              bottom={0}
              zIndex={100}
              backgroundColor="background-primary"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              paddingHorizontal={{ base: '2xl', md: '5xl' }}
              rowGap="2xl"
            >
              <Box position="absolute" top="xl" right="2xl">
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => setSearchOpen(false)}
                  className="cursor-pointer border-0 bg-transparent p-0"
                >
                  <Box
                    color={{ base: 'text-primary', hover: 'text-tertiary' }}
                    transitionProperty="colors"
                    transitionDuration="fast"
                    ease="decelerate"
                  >
                    <X size={32} strokeWidth={1.5} />
                  </Box>
                </button>
              </Box>
              <input
                type="text"
                placeholder="Search..."
                aria-label="Search"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchOpen(false)
                }}
                className="w-full appearance-none rounded-none border-0 bg-transparent text-4xl text-black caret-current opacity-100 shadow-none ring-0 outline-none placeholder:text-current placeholder:opacity-30 focus:shadow-none focus:ring-0 focus:outline-none focus-visible:outline-none md:text-6xl dark:text-white"
              />
            </Box>,
            document.body,
          )
        : null}
    </Box>
  )
}
