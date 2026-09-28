import { experiments as registry } from './experiments'

export interface ExperimentDefinition<V extends readonly string[]> {
  description: string
  variants: V
  defaultVariant: V[number]
}

export type ExperimentRegistry = Record<
  string,
  ExperimentDefinition<readonly string[]>
>

export type ExperimentName = keyof typeof registry

export type ExperimentVariant<T extends ExperimentName> =
  (typeof registry)[T]['variants'][number]

export const experiments: Record<
  ExperimentName,
  ExperimentDefinition<readonly string[]>
> = registry

export type ExperimentResult<T extends ExperimentName> = {
  variant: ExperimentVariant<T>
  isControl: boolean
  isTreatment: boolean
}

export function getDefaultVariant<T extends ExperimentName>(
  experimentName: T,
): ExperimentVariant<T> {
  return experiments[experimentName].defaultVariant as ExperimentVariant<T>
}

export function getExperimentNames(): ExperimentName[] {
  return Object.keys(experiments) as ExperimentName[]
}
