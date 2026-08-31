'use client'

import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  const [condensed, setCondensed] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 240)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
    <Box as="header" flexDirection="column">
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        zIndex={50}
        backgroundColor="background-primary"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        paddingHorizontal={{ base: 'l', md: '2xl' }}
        paddingVertical="m"
        alignItems="center"
        justifyContent="between"
        columnGap="3xl"
        transform={condensed ? 'translateY(0)' : 'translateY(-100%)'}
        transitionProperty="transform"
        transitionDuration="base"
        ease="decelerate"
      >
        <Link href={base}>
          <Text variant="heading-xs" truncate>
            {organizationName}
          </Text>
        </Link>
        <Box alignItems="center" columnGap="2xl">
          <Box as="nav" alignItems="baseline" columnGap="xl">
            {nav.map((item) => (
              <Link key={item.index} href={item.href}>
                <Box
                  alignItems="baseline"
                  columnGap="s"
                  color={{ base: 'text-primary', hover: 'text-tertiary' }}
                  transitionProperty="colors"
                  transitionDuration="fast"
                  ease="decelerate"
                >
                  <Text
                    variant="heading-xxs"
                    color={isActive(item.href) ? 'default' : 'muted'}
                  >
                    {isActive(item.href) ? '—' : item.index}
                  </Text>
                  <Text variant="heading-xxs" color="inherit">
                    {item.label}
                  </Text>
                </Box>
              </Link>
            ))}
          </Box>
          <button
            type="button"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className="cursor-pointer border-0 bg-transparent p-0"
          >
            <Box
              color={{ base: 'text-primary', hover: 'text-tertiary' }}
              transitionProperty="colors"
              transitionDuration="fast"
              ease="decelerate"
            >
              <Search size={20} strokeWidth={1.5} />
            </Box>
          </button>
        </Box>
      </Box>
      <Grid
        templateColumns={{
          base: '1fr',
          md: 'repeat(2, 1fr)',
          lg: 'repeat(4, 1fr)',
        }}
        columnGap="none"
        rowGap="3xl"
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
            <Link key={item.index} href={item.href}>
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
          ))}
        </Box>
        {subnav ? (
          <Box as="nav" flexDirection="column" rowGap="s">
            {subnav.map((item, position) => (
              <Link key={item.href} href={item.href}>
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
                      color={isSubActive(item) ? 'default' : 'muted'}
                    >
                      {isSubActive(item)
                        ? '—'
                        : String(position + 1).padStart(2, '0')}
                    </Text>
                  </Box>
                  <Text variant="heading-xs" color="inherit">
                    {item.label}
                  </Text>
                </Box>
              </Link>
            ))}
          </Box>
        ) : (
          <Box />
        )}
        <Box justifyContent="end">
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
        </Box>
      </Grid>
      {searchOpen ? (
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
          <Box position="absolute" top="2xl" right="2xl">
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
        </Box>
      ) : null}
    </Box>
  )
}
