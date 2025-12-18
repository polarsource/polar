'use client'

import { type ReactNode, createContext, useContext } from 'react'
import { useExperiment } from './client'
import type { ExperimentName } from './index'

interface ExperimentContextValue {
  variant: string
  isControl: boolean
  isTreatment: boolean
}

const ExperimentContext = createContext<ExperimentContextValue | null>(null)

function useExperimentComponentContext() {
  const context = useContext(ExperimentContext)
  if (!context) {
    throw new Error(
      'Experiment.Control/Treatment must be used within an Experiment component',
    )
  }
  return context
}

interface ExperimentProps<T extends ExperimentName> {
  name: T
  children: ReactNode
}

function Experiment<T extends ExperimentName>({
  name,
  children,
}: ExperimentProps<T>) {
  const experimentResult = useExperiment(name)

  return (
    <ExperimentContext.Provider value={experimentResult}>
      {children}
    </ExperimentContext.Provider>
  )
}

interface VariantProps {
  children: ReactNode
}

function Control({ children }: VariantProps) {
  const { isControl } = useExperimentComponentContext()
  return isControl ? <>{children}</> : null
}

function Treatment({ children }: VariantProps) {
  const { isTreatment } = useExperimentComponentContext()
  return isTreatment ? <>{children}</> : null
}

interface VariantMatchProps {
  match: string
  children: ReactNode
}

function Variant({ match, children }: VariantMatchProps) {
  const { variant } = useExperimentComponentContext()
  return variant === match ? <>{children}</> : null
}

Experiment.Control = Control
Experiment.Treatment = Treatment
Experiment.Variant = Variant

export { Experiment }
