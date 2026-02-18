'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { ExperimentName, ExperimentVariant } from './index'

type ExperimentVariants = {
  [K in ExperimentName]?: ExperimentVariant<K>
}

interface ExperimentContextValue {
  experiments: ExperimentVariants
  orgId?: string
}

const ExperimentContext = createContext<ExperimentContextValue>({
  experiments: {},
})

interface ExperimentProviderProps {
  children: ReactNode
  experiments?: ExperimentVariants
  orgId?: string
}

export function ExperimentProvider({
  children,
  experiments,
  orgId,
}: ExperimentProviderProps) {
  const parent = useContext(ExperimentContext)

  const value = useMemo(
    () => ({
      experiments: experiments ?? parent.experiments,
      orgId: orgId ?? parent.orgId,
    }),
    [experiments, orgId, parent.experiments, parent.orgId],
  )

  return (
    <ExperimentContext.Provider value={value}>
      {children}
    </ExperimentContext.Provider>
  )
}

export function useExperimentContext() {
  return useContext(ExperimentContext)
}
