'use client'

import { usePostHog } from '@/hooks/posthog'
import { schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const links = (organization: schemas['Organization']) => [
  { href: `/${organization.slug}/portal/`, label: 'Overview' },
  { href: `/${organization.slug}/portal/usage/`, label: 'Usage' },
  { href: `/${organization.slug}/portal/settings/`, label: 'Settings' },
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
    <>
      <nav className="hidden w-64 flex-col gap-y-1 py-12 md:flex">
        {links(organization)
          .filter(({ label }) =>
            label === 'Usage' ? isFeatureEnabled('usage_based_billing') : true,
          )
          .map((link) => (
            <Link
              key={link.href}
              href={buildPath(link.href)}
              className={twMerge(
                'dark:text-polar-500 dark:hover:bg-polar-800 rounded-xl border border-transparent px-4 py-2 font-medium text-gray-500 transition-colors duration-75 hover:bg-gray-100',
                currentPath === link.href &&
                  'dark:bg-polar-800 dark:border-polar-700 bg-gray-100 text-black dark:text-white',
              )}
            >
              {link.label}
            </Link>
          ))}
      </nav>
      <Select defaultValue={currentPath}>
        <SelectTrigger className="md:hidden">
          <SelectValue>
            {
              links(organization).find(({ href }) => href === currentPath)
                ?.label
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {links(organization).map((link) => (
            <Link key={link.href} href={buildPath(link.href)}>
              <SelectItem value={link.href}>{link.label}</SelectItem>
            </Link>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
