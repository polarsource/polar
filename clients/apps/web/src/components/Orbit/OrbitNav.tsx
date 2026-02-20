'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const nav = [
  {
    section: 'Get started',
    items: [
      { label: 'Overview', href: '/orbit' },
      { label: 'Guidelines', href: '/orbit/guidelines' },
    ],
  },
  {
    section: 'Foundations',
    items: [{ label: 'Design Tokens', href: '/orbit/tokens' }],
  },
  {
    section: 'Components',
    items: [
      { label: 'Headline', href: '/orbit/components/headline' },
      { label: 'Button', href: '/orbit/components/button' },
      { label: 'Card', href: '/orbit/components/card' },
      { label: 'Input', href: '/orbit/components/input' },
      { label: 'BarChart', href: '/orbit/components/barchart' },
    ],
  },
]

export function OrbitNav() {
  const pathname = usePathname()

  return (
    <aside className="dark:border-polar-800 flex h-full w-56 shrink-0 flex-col gap-10 overflow-y-auto border-r border-neutral-200 py-10">
      <Link href="/orbit" className="flex flex-col gap-0.5 px-8">
        <span className="dark:text-polar-500 text-[10px] uppercase tracking-widest text-neutral-400">
          Polar Software Inc
        </span>
        <span className="text-lg font-light tracking-tighter text-black dark:text-white">
          Orbit
        </span>
      </Link>

      <nav className="flex flex-col gap-7 px-8">
        {nav.map(({ section, items }) => (
          <div key={section} className="flex flex-col gap-0.5">
            <span className="dark:text-polar-500 pb-2.5 text-[10px] uppercase tracking-widest text-neutral-400">
              {section}
            </span>
            {items.map(({ label, href }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={twMerge(
                    'border-l py-1 pl-3 text-sm transition-colors duration-150',
                    isActive
                      ? 'border-black font-medium text-black dark:border-white dark:text-white'
                      : 'dark:text-polar-500 dark:hover:border-polar-600 dark:hover:text-polar-200 border-transparent text-neutral-500 hover:border-neutral-300 hover:text-black',
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
