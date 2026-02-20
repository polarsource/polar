'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const tabs = [
  { label: 'Company', href: '/experimental/company' },
  { label: 'Team', href: '/experimental/company/team' },
  { label: 'Careers', href: '/experimental/company/careers' },
  { label: 'Investors', href: '/experimental/company/investors' },
]

export function CompanyNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-16">
      <Link href="/">
        <LogoIcon size={40} />
      </Link>
      <div className="flex items-center gap-6">
        {tabs.map(({ label, href }) => {
          const active = pathname === href
          return (
            <Link
              key={label}
              href={href}
              className={twMerge(
                'transition-colors',
                active
                  ? 'font-medium text-black dark:text-white'
                  : 'dark:text-polar-500 text-neutral-400 hover:text-black dark:hover:text-white',
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
