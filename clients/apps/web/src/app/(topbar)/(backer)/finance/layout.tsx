'use client'

import { usePersonalFinanceSubRoutes } from '@/components/Dashboard/navigation'
import { SubNav } from '@/components/Navigation/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  const subRoutes = usePersonalFinanceSubRoutes()

  return (
    <div className="dark:bg-polar-900 dark:border-polar-700 relative flex w-full flex-col gap-y-8 rounded-2xl border border-gray-200 bg-gray-50 p-12 shadow-sm">
      <h1 className="text-2xl font-medium">Finance</h1>
      <SubNav items={subRoutes} />
      {children}
    </div>
  )
}
