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
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const links = (organization: schemas['Organization']) => [
  {
    href: `/${organization.slug}/portal/overview`,
    label: 'Overview',
    isActive: (path: string) => path.includes('/overview'),
  },
  {
    href: `/${organization.slug}/portal/usage`,
    label: 'Usage',
    isActive: (path: string) => path.includes('/usage'),
  },
  {
    href: `/${organization.slug}/portal/settings`,
    label: 'Settings',
    isActive: (path: string) => path.includes('/settings'),
  },
]

export const Navigation = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const currentPath = usePathname()
  const searchParams = useSearchParams()
  const { isFeatureEnabled } = usePostHog()

  const buildPath = (path: string) => {
    return `${path}?${searchParams.toString()}`
  }

  const filteredLinks = links(organization).filter(({ label }) =>
    label === 'Usage' ? isFeatureEnabled('usage_based_billing') : true,
  )

  return (
    <>
      <nav className="hidden w-64 flex-col gap-y-1 py-12 md:flex">
        {filteredLinks.map((link) => (
          <Link
            key={link.href}
            href={buildPath(link.href)}
            className={twMerge(
              'dark:text-polar-500 dark:hover:bg-polar-800 rounded-xl border border-transparent px-4 py-2 font-medium text-gray-500 transition-colors duration-75 hover:bg-gray-100',
              link.isActive(currentPath) &&
                'dark:bg-polar-800 dark:border-polar-700 bg-gray-100 text-black dark:text-white',
            )}
            prefetch
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Select
        defaultValue={
          filteredLinks.find(({ href }) => href === currentPath)?.label
        }
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
