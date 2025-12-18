'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ExperimentName, ExperimentVariant } from './index'

type ExperimentVariants = {
  [K in ExperimentName]?: ExperimentVariant<K>
}

const ExperimentContext = createContext<ExperimentVariants>({})

interface ExperimentProviderProps {
  children: ReactNode
  experiments: ExperimentVariants
}

export function ExperimentProvider({
  children,
  experiments,
}: ExperimentProviderProps) {
  return (
    <ExperimentContext.Provider value={experiments}>
      {children}
    </ExperimentContext.Provider>
  )
}

export function useExperimentContext() {
  return useContext(ExperimentContext)
}
