'use client'

import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const settingsTabs = [
  { title: 'Organization', suffix: '' },
  { title: 'Billing', suffix: '/billing' },
  { title: 'Members', suffix: '/members' },
  { title: 'Webhooks', suffix: '/webhooks' },
  { title: 'Custom Fields', suffix: '/custom-fields' },
]

export default function SettingsLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/settings`

  const activeTab =
    settingsTabs.find((t) =>
      t.suffix === ''
        ? pathname === base || pathname === `${base}/`
        : pathname.startsWith(`${base}${t.suffix}`),
    ) ?? settingsTabs[0]

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-6 md:px-8">
        <Tabs value={activeTab.title}>
          <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
            {settingsTabs.map((tab) => (
              <Link
                key={tab.suffix}
                href={`${base}${tab.suffix}`}
                prefetch={true}
              >
                <TabsTrigger
                  className="flex flex-row items-center gap-x-2 px-4"
                  value={tab.title}
                >
                  {tab.title}
                </TabsTrigger>
              </Link>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {children}
    </div>
  )
}
