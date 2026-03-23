import { schemas } from '@polar-sh/client'
import { PropsWithChildren, createContext, useMemo } from 'react'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DashboardContextValue {}

const defaultDashboardContextValue: DashboardContextValue = {}

const DashboardContext = createContext<DashboardContextValue>(
  defaultDashboardContextValue,
)

export const DashboardProvider = ({
  children,
}: PropsWithChildren<{
  organization: schemas['Organization'] | undefined
}>) => {
  const value = useMemo(() => ({}), [])

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  )
}
