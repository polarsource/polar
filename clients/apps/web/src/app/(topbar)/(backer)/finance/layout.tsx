'use client'

import { personalFinanceSubRoutes } from '@/components/Dashboard/navigation'
import { SubNav } from '@/components/Navigation/DashboardTopbar'
import { usePathname } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const subRoutes = personalFinanceSubRoutes()

  return (
    <div className="flex flex-col gap-y-8">
      <SubNav
        items={
          subRoutes.map((sub) => ({
            ...sub,
            active: sub.link === pathname,
          })) ?? []
        }
      />

      {children}
    </div>
  )
}
