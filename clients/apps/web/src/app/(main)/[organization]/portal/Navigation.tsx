'use client'

import { schemas } from '@polar-sh/client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const links = [
  { href: '/', label: 'Overview' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/usage', label: 'Usage' },
  { href: '/orders', label: 'Orders' },
]

export const Navigation = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const currentPath = usePathname()
  const searchParams = useSearchParams()

  const buildPath = (path: string) => {
    const url = new URL(window.location.origin + currentPath)
    url.pathname = `/${organization.slug}/portal${path}`

    for (const [key, value] of searchParams.entries()) {
      url.searchParams.set(key, value)
    }

    return url.toString()
  }

  return (
    <nav className="flex w-64 flex-col gap-y-2 py-12 pr-12">
      {links.map((link) => (
        <Link
          key={link.href}
          href={buildPath(link.href)}
          className={twMerge(
            'dark:text-polar-500 text-gray-500',
            currentPath.includes(link.href) && 'text-blue-500 dark:text-white',
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
