import { experiments } from './experiments'
import type { ExperimentDefinition } from './types'
export type { ExperimentDefinition, ExperimentRegistry } from './types'
export { experiments }

export type ExperimentName = keyof typeof experiments

export type ExperimentVariant<T extends ExperimentName> =
  (typeof experiments)[T]['variants'][number]

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

export function isOrgOptedOut<T extends ExperimentName>(
  experimentName: T,
  orgSlug?: string,
): boolean {
  if (!orgSlug) return false
  const experiment = experiments[experimentName] as ExperimentDefinition<
    readonly string[]
  >
  return experiment.optOutOrgSlugs?.includes(orgSlug) ?? false
}
