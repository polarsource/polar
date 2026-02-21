'use client'

import { Headline } from '@/components/Orbit/Headline'
import { Text } from '@/components/Orbit/Text'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from '@polar-sh/ui/components/ui/sidebar'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const nav = [
  {
    section: 'Get started',
    items: [
      { label: 'Introduction', href: '/orbit' },
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
      { label: 'Box', href: '/orbit/components/box' },
      { label: 'Headline', href: '/orbit/components/headline' },
      { label: 'Text', href: '/orbit/components/text' },
      { label: 'Button', href: '/orbit/components/button' },
      { label: 'Card', href: '/orbit/components/card' },
      { label: 'Input', href: '/orbit/components/input' },
      { label: 'BarChart', href: '/orbit/components/barchart' },
      { label: 'DataTable', href: '/orbit/components/datatable' },
      { label: 'Status', href: '/orbit/components/status' },
    ],
  },
]

export function OrbitNav() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-none" collapsible="offcanvas">
      <SidebarHeader className="px-8 pt-10 pb-0">
        <Link href="/orbit" className="flex flex-col gap-1">
          <Headline as="h6" text="Orbit" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-8 py-6">
        <nav className="flex flex-col gap-7">
          {nav.map(({ section, items }) => (
            <div key={section} className="flex flex-col gap-0.5">
              <Text
                as="span"
                variant="subtle"
                fontSize="xs"
                className="pb-2.5"
              >
                {section}
              </Text>
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
      </SidebarContent>
    </Sidebar>
  )
}
