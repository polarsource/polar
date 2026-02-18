'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { ExperimentName, ExperimentVariant } from './index'

type ExperimentVariants = {
  [K in ExperimentName]?: ExperimentVariant<K>
}

interface ExperimentContextValue {
  experiments: ExperimentVariants
  orgSlug?: string
}

const ExperimentContext = createContext<ExperimentContextValue>({
  experiments: {},
})

interface ExperimentProviderProps {
  children: ReactNode
  experiments?: ExperimentVariants
  orgSlug?: string
}

export function ExperimentProvider({
  children,
  experiments,
  orgSlug,
}: ExperimentProviderProps) {
  const parent = useContext(ExperimentContext)

  const value = useMemo(
    () => ({
      experiments: experiments ?? parent.experiments,
      orgSlug: orgSlug ?? parent.orgSlug,
    }),
    [experiments, orgSlug, parent.experiments, parent.orgSlug],
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
