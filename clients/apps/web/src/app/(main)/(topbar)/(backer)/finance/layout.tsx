'use client'

import { usePersonalFinanceSubRoutes } from '@/components/Dashboard/navigation'
import { SubNav } from '@/components/Navigation/SubNav'

export default function Layout({ children }: { children: React.ReactNode }) {
  const subRoutes = usePersonalFinanceSubRoutes()

  return (
    <div className="flex w-full flex-col gap-y-8">
      <h1 className="text-2xl font-medium">Finance</h1>
      <SubNav items={subRoutes} />
      {children}
    </div>
  )
}
