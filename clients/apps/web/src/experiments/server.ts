import { getDistinctId } from '@/experiments/distinct-id'
import { getPostHogServer } from '@/experiments/posthog-server'
import {
  type ExperimentName,
  type ExperimentVariant,
  experiments,
  getDefaultVariant,
} from './index'

export interface GetExperimentOptions {
  distinctId?: string
  /**
   * Whether to track exposure in PostHog. Defaults to true.
   * Set to false when pre-fetching experiments for the provider.
   */
  trackExposure?: boolean
}

export async function getExperiment<T extends ExperimentName>(
  experimentName: T,
  options?: GetExperimentOptions,
): Promise<ExperimentVariant<T>> {
  const { trackExposure = true } = options ?? {}
  const posthog = getPostHogServer()

  if (!posthog) {
    return getDefaultVariant(experimentName)
  }

  const distinctId = options?.distinctId ?? (await getDistinctId())
  const experiment = experiments[experimentName]

  try {
    const flagValue = await posthog.getFeatureFlag(experimentName, distinctId, {
      sendFeatureFlagEvents: trackExposure,
    })

    if (typeof flagValue === 'string') {
      const validVariants = experiment.variants as readonly string[]
      if (validVariants.includes(flagValue)) {
        return flagValue as ExperimentVariant<T>
      }
    }

    if (typeof flagValue === 'boolean') {
      return (flagValue ? 'treatment' : 'control') as ExperimentVariant<T>
    }

    return getDefaultVariant(experimentName)
  } catch (error) {
    console.error(`Error fetching experiment ${experimentName}:`, error)
    return getDefaultVariant(experimentName)
  }
}

/**
 * Fetch multiple experiments at once. Used by ExperimentProvider.
 * Does NOT track exposure - tracking happens in useExperiment().
 */
export async function getExperiments<T extends ExperimentName>(
  experimentNames: T[],
  options?: Omit<GetExperimentOptions, 'trackExposure'>,
): Promise<Record<T, ExperimentVariant<T>>> {
  const distinctId = options?.distinctId ?? (await getDistinctId())

  const results = await Promise.all(
    experimentNames.map(async (name) => {
      const variant = await getExperiment(name, {
        distinctId,
        trackExposure: false,
      })
      return [name, variant] as const
    }),
  )

  return Object.fromEntries(results) as Record<T, ExperimentVariant<T>>
}
