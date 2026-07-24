'use client'

import { usePortalAuthenticatedUser } from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { type AcceptedLocale } from '@polar-sh/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const links = (
  organization: schemas['CustomerOrganization'],
  authenticatedUser: schemas['PortalAuthenticatedUser'] | undefined,
) => {
  const portalSettings = organization.customer_portal_settings
  const canAccessBilling = hasBillingPermission(authenticatedUser)

  return [
    {
      href: `/${organization.slug}/portal/overview`,
      label: 'Overview',
      isActive: (path: string) => path.includes('/overview'),
    },
    ...(canAccessBilling
      ? [
          {
            href: `/${organization.slug}/portal/orders`,
            label: 'Orders',
            isActive: (path: string) => path.includes('/orders'),
          },
        ]
      : []),
    ...(portalSettings.usage.show
      ? [
          {
            href: `/${organization.slug}/portal/usage`,
            label: 'Usage',
            isActive: (path: string) => path.includes('/usage'),
          },
        ]
      : []),
    ...(canAccessBilling
      ? [
          {
            href: `/${organization.slug}/portal/settings`,
            label: 'Billing',
            isActive: (path: string) => path.includes('/settings'),
          },
        ]
      : []),
  ]
}

const NavigationContent = ({
  organization,
  api,
  currentPath,
  searchParams,
}: {
  organization: schemas['CustomerOrganization']
  api: Client
  currentPath: string
  searchParams: URLSearchParams
}) => {
  const router = useRouter()
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)

  const buildPath = (path: string) => {
    return `${path}?${searchParams.toString()}`
  }

  const filteredLinks = links(organization, authenticatedUser)

  return (
    <>
      <Box
        as="nav"
        position="sticky"
        top={0}
        display={{ base: 'none', md: 'flex' }}
        height="fit-content"
        width={{ md: 160, lg: 256 }}
        flexShrink={0}
        flexDirection="column"
        rowGap="xl"
        paddingVertical="3xl"
      >
        <Box flexDirection="column">
          {authenticatedUser?.name && (
            <Text as="h3" variant="title">
              {authenticatedUser.name}
            </Text>
          )}
          <Text color={authenticatedUser?.name ? 'muted' : 'default'}>
            {authenticatedUser?.email ?? '—'}
          </Text>
        </Box>
        <Box flexDirection="column" rowGap="xs">
          {filteredLinks.map((link) => {
            const isActive = link.isActive(currentPath)
            return (
              <Link key={link.href} href={buildPath(link.href)} prefetch>
                <Box
                  borderRadius="s"
                  paddingHorizontal="m"
                  paddingVertical="s"
                  backgroundColor={{
                    base: isActive ? 'background-secondary' : undefined,
                    hover: 'background-secondary',
                  }}
                  transitionProperty="colors"
                  transitionDuration="fast"
                >
                  <Text variant="title" color={isActive ? 'default' : 'muted'}>
                    {link.label}
                  </Text>
                </Box>
              </Link>
            )
          })}
        </Box>
      </Box>
      <Box display={{ base: 'block', md: 'none' }}>
        <Select
          value={filteredLinks.find(({ href }) => href === currentPath)?.label}
          onValueChange={(value) => {
            router.push(
              buildPath(
                filteredLinks.find(({ label }) => label === value)?.href ?? '',
              ),
            )
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select page" />
          </SelectTrigger>
          <SelectContent>
            {filteredLinks.map((link) => (
              <SelectItem key={link.href} value={link.label}>
                {link.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Box>
    </>
  )
}

export const Navigation = ({
  organization,
}: {
  organization: schemas['CustomerOrganization']
  locale?: AcceptedLocale
  localizationEnabled?: boolean
}) => {
  const currentPath = usePathname()
  const searchParams = useSearchParams()

  const token =
    searchParams.get('customer_session_token') ??
    searchParams.get('member_session_token')

  if (!token) {
    return null
  }

  const api = createClientSideAPI(token)

  return (
    <NavigationContent
      organization={organization}
      api={api}
      currentPath={currentPath}
      searchParams={searchParams}
    />
  )
}
