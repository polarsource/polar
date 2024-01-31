'use client'

import { dashboardRoutes } from '@/components/Dashboard/navigation'
import { SubNav } from '@/components/Shared/DashboardTopbar'
import { usePathname } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const [currentRoute] = dashboardRoutes(undefined, true, true).filter(
    (route) => pathname?.startsWith(route.link),
  )

  return (
    <div className="flex flex-col gap-y-8">
      {currentRoute &&
        'subs' in currentRoute &&
        (currentRoute.subs?.length ?? 0) > 0 && (
          <SubNav
            items={
              currentRoute.subs?.map((sub) => ({
                ...sub,
                active: sub.link === pathname,
              })) ?? []
            }
          />
        )}
      {children}
    </div>
  )
}
