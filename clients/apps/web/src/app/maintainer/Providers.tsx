'use client'

import DashboardLayoutContext, {
  useDashboardLayoutContext,
} from '@/components/Layout/DashboardLayoutContext'

export function DashboardLayoutContextProvider({
  probablyIsMDOrLarger,
  children,
}: {
  probablyIsMDOrLarger: boolean
  children: React.ReactNode
}) {
  const layoutContext = useDashboardLayoutContext(probablyIsMDOrLarger)

  return (
    <DashboardLayoutContext.Provider value={layoutContext}>
      {children}
    </DashboardLayoutContext.Provider>
  )
}
