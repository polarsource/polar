'use client'

import { usePortalAuthenticatedUser } from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { type AcceptedLocale } from '@polar-sh/i18n'
import { Box } from '@polar-sh/orbit/Box'
import { PortalText } from '@/components/CustomerPortal/PortalPrimitives'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

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
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)

  const buildPath = (path: string) => {
    return `${path}?${searchParams.toString()}`
  }

  const filteredLinks = links(organization, authenticatedUser)

  return (
    <>
      <Box
        as="nav"
        flexDirection={{ base: 'row', md: 'column' }}
        columnGap="xl"
        rowGap="s"
        overflowX={{ base: 'auto', md: 'visible' }}
        paddingBottom={{ base: 'l', md: 'none' }}
      >
        {filteredLinks.map((link) => {
          const isActive = link.isActive(currentPath)
          return (
            <Link
              key={link.href}
              href={buildPath(link.href)}
              className="shrink-0 text-sm md:text-lg"
              aria-current={isActive ? 'page' : undefined}
              prefetch
            >
              <Box
                as="span"
                color={
                  isActive
                    ? 'text-primary'
                    : { base: 'text-secondary', hover: 'text-primary' }
                }
                transitionProperty="colors"
                transitionDuration="fast"
              >
                {link.label}
              </Box>
            </Link>
          )
        })}
      </Box>
      {authenticatedUser ? (
        <Box
          flexDirection="column"
          marginTop="auto"
          display={{ base: 'none', md: 'flex' }}
        >
          <Box paddingBottom="xs">
            <PortalText tone="tertiary" className="text-xs">
              Signed in as
            </PortalText>
          </Box>
          {authenticatedUser.name ? (
            <PortalText tone="primary" block className="truncate text-sm">
              {authenticatedUser.name}
            </PortalText>
          ) : null}
          <PortalText tone="secondary" block className="truncate text-sm">
            {authenticatedUser.email}
          </PortalText>
        </Box>
      ) : null}
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
