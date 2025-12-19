'use client'

import {
  useAuthenticatedCustomer,
  useCustomerPortalSession,
} from '@/hooks/queries'
import { createClientSideAPI } from '@/utils/client'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@polar-sh/client'
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

const links = (organization: schemas['CustomerOrganization']) => {
  const portalSettings = organization.customer_portal_settings
  return [
    {
      href: `/${organization.slug}/portal/overview`,
      label: 'Overview',
      isActive: (path: string) => path.includes('/overview'),
    },
    {
      href: `/${organization.slug}/portal/orders`,
      label: 'Orders',
      isActive: (path: string) => path.includes('/orders'),
    },
    ...(portalSettings.usage.show
      ? [
          {
            href: `/${organization.slug}/portal/usage`,
            label: 'Usage',
            isActive: (path: string) => path.includes('/usage'),
          },
        ]
      : []),
    {
      href: `/${organization.slug}/portal/settings`,
      label: 'Billing',
      isActive: (path: string) => path.includes('/settings'),
    },
  ]
}

export const Navigation = ({
  organization,
}: {
  organization: schemas['CustomerOrganization']
}) => {
  const router = useRouter()
  const currentPath = usePathname()
  const searchParams = useSearchParams()

  const api = createClientSideAPI(
    searchParams.get('customer_session_token') as string,
  )
  const { data: customerPortalSession } = useCustomerPortalSession(api)
  const { data: authenticatedCustomer } = useAuthenticatedCustomer(api)

  // Hide navigation on routes where portal access is being requested or authenticated
  const hideNav =
    currentPath.endsWith('/portal/request') ||
    currentPath.endsWith('/portal/authenticate')

  if (hideNav) {
    return null
  }

  const buildPath = (path: string) => {
    return `${path}?${searchParams.toString()}`
  }

  const filteredLinks = links(organization)

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
          <h3>{authenticatedCustomer?.name ?? '—'}</h3>
          <span className="dark:text-polar-500 text-gray-500">
            {authenticatedCustomer?.email ?? '—'}
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
          <SelectValue>
            {filteredLinks.find(({ href }) => href === currentPath)?.label}
          </SelectValue>
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
