'use client'

import {
  useAuthenticatedCustomer,
  useCustomerPortalSession,
  usePortalAuthenticatedUser,
} from '@/hooks/queries'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { Client, schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const links = (
  organization: schemas['CustomerOrganization'],
  authenticatedUser: schemas['PortalAuthenticatedUser'] | undefined,
  customer: schemas['CustomerPortalCustomer'] | undefined,
) => {
  const portalSettings = organization.customer_portal_settings
  const canAccessBilling = hasBillingPermission(authenticatedUser)
  const isTeamCustomer = customer?.type === 'team'

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
    ...(isTeamCustomer && canAccessBilling && organization.organization_features.member_model_enabled
      ? [
          {
            href: `/${organization.slug}/portal/team`,
            label: 'Team',
            isActive: (path: string) => path.includes('/team'),
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

// Inner component that uses hooks - only rendered when token is available
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
  const { data: customerPortalSession } = useCustomerPortalSession(api)
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const { data: customer } = useAuthenticatedCustomer(api)

  const buildPath = (path: string) => {
    return `${path}?${searchParams.toString()}`
  }

  const filteredLinks = links(organization, authenticatedUser, customer)

  return (
    <>
      <nav className="sticky top-0 hidden h-fit w-40 flex-none flex-col gap-y-6 py-12 md:flex lg:w-64">
        {customerPortalSession && customerPortalSession.return_url && (
          <Link
            href={customerPortalSession.return_url}
            className="dark:text-polar-500 flex flex-row items-center gap-x-4 py-2 text-gray-500"
          >
            <ArrowBackOutlined fontSize="inherit" />
            <span>Back to {organization.name}</span>
          </Link>
        )}
        <div className="flex flex-col">
          <h3>{authenticatedUser?.name ?? '—'}</h3>
          <span className="dark:text-polar-500 text-gray-500">
            {authenticatedUser?.email ?? '—'}
          </span>
        </div>
        <div className="flex flex-col gap-y-1">
          {filteredLinks.map((link) => (
            <Link
              key={link.href}
              href={buildPath(link.href)}
              className={twMerge(
                'dark:text-polar-500 dark:hover:bg-polar-800 rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors duration-75 hover:bg-gray-100',
                link.isActive(currentPath) &&
                  'dark:bg-polar-800 dark:border-polar-700 bg-gray-100 text-black dark:text-white',
              )}
              prefetch
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
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
        <SelectTrigger className="md:hidden">
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
    </>
  )
}

export const Navigation = ({
  organization,
}: {
  organization: schemas['CustomerOrganization']
}) => {
  const currentPath = usePathname()
  const searchParams = useSearchParams()

  // Hide navigation on routes where portal access is being requested or authenticated
  if (
    currentPath.endsWith('/portal/request') ||
    currentPath.endsWith('/portal/authenticate')
  ) {
    return null
  }

  const token =
    searchParams.get('customer_session_token') ??
    searchParams.get('member_session_token')

  // Don't render until token is available (handles SSR/hydration)
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
