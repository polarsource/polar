'use client'

import { usePersonalFinanceSubRoutes } from '@/components/Dashboard/navigation'
import { SubNav } from '@/components/Navigation/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  const subRoutes = usePersonalFinanceSubRoutes()

  return (
    <div className="flex flex-col gap-y-8">
      <SubNav items={subRoutes} />
      {children}
    </div>
  )
}
