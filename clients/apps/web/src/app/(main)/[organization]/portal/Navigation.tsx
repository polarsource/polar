'use client'

import { usePostHog } from '@/hooks/posthog'
import { schemas } from '@polar-sh/client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const links = (organization: schemas['Organization']) => [
  { href: `/${organization.slug}/portal`, label: 'Overview' },
  {
    href: `/${organization.slug}/portal/subscriptions`,
    label: 'Subscriptions',
  },
  { href: `/${organization.slug}/portal/orders`, label: 'Orders' },
  { href: `/${organization.slug}/portal/usage`, label: 'Usage' },
]

export const Navigation = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const currentPath = usePathname()
  const searchParams = useSearchParams()
  const { isFeatureEnabled } = usePostHog()

  const buildPath = (path: string) => {
    const url = new URL(window.location.origin + currentPath)
    url.pathname = path

    for (const [key, value] of searchParams.entries()) {
      url.searchParams.set(key, value)
    }

    return url.toString()
  }

  return (
    <nav className="flex w-64 flex-col gap-y-2 py-12 pr-12">
      {links(organization)
        .filter(({ label }) =>
          label === 'Usage' ? isFeatureEnabled('usage_based_billing') : true,
        )
        .map((link) => (
          <Link
            key={link.href}
            href={buildPath(link.href)}
            className={twMerge(
              'dark:text-polar-500 text-gray-500',
              currentPath === link.href && 'text-blue-500 dark:text-white',
            )}
          >
            {link.label}
          </Link>
        ))}
    </nav>
  )
}
