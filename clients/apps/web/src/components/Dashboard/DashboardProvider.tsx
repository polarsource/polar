import { schemas } from '@polar-sh/client'
import { PropsWithChildren, createContext } from 'react'

// oxlint-disable-next-line typescript/no-empty-object-type
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
  return (
    <DashboardContext.Provider value={{}}>{children}</DashboardContext.Provider>
  )
}
