import { schemas } from '@spaire/client'
import { PropsWithChildren, createContext, useContext } from 'react'

export interface DashboardContextValue {}

const defaultDashboardContextValue: DashboardContextValue = {}

export const DashboardContext = createContext<DashboardContextValue>(
  defaultDashboardContextValue,
)

export const DashboardProvider = ({
  children,
}: PropsWithChildren<{
  organization: schemas['Organization'] | undefined
}>) => {
  return (
    <DashboardContext.Provider value={{}}>{children}</DashboardContext.Provider>
  )
}

export const useDashboard = () => useContext(DashboardContext)
