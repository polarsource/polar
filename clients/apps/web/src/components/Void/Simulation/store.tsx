'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useContext, useMemo, useRef } from 'react'
import {
  useVoidScenarios,
  useVoidScenarioMutations,
  useVoidDeploys,
  versionLabel,
  versionLabels,
  VoidScenario,
  VoidDeploy,
} from '../api'
import {
  configurationFromLevers,
  DEFAULT_ASSUMPTIONS,
  leversFromConfiguration,
  patchFromLevers,
} from './baseline'
import { Assumptions, Scenario, ScenarioLevers } from './types'

const ASSUMPTIONS_KEY = 'void-simulation-assumptions'

const loadAssumptions = (): Record<string, Assumptions> => {
  try {
    const raw = window.localStorage.getItem(ASSUMPTIONS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, Assumptions>) : {}
  } catch {
    return {}
  }
}

const saveAssumptions = (all: Record<string, Assumptions>) => {
  try {
    window.localStorage.setItem(ASSUMPTIONS_KEY, JSON.stringify(all))
  } catch {
    // Assumptions are a per-browser convenience; losing them is fine.
  }
}

const toScenario = (
  scenario: VoidScenario,
  deploys: VoidDeploy[],
  assumptions: Assumptions,
): Scenario => {
  const promoted = deploys.find((d) => d.id === scenario.promoted_deployment_id)
  const labels = versionLabels(deploys)
  return {
    id: scenario.id,
    name: scenario.name,
    basedOn: {
      version: scenario.base_version_id,
      label: versionLabel(labels, scenario.base_version_id),
    },
    createdAt: scenario.created_at,
    updatedAt: scenario.modified_at ?? scenario.created_at,
    promotedAs: scenario.promoted_deployment_id
      ? versionLabel(labels, promoted?.version_id ?? scenario.version_id)
      : null,
    levers: leversFromConfiguration(scenario.configuration, assumptions),
    baseLevers: leversFromConfiguration(
      scenario.base_configuration,
      assumptions,
    ),
    patch: scenario.patch,
    configuration: scenario.configuration,
  }
}

export type NewScenario = Pick<Scenario, 'name' | 'basedOn'>

const PERSIST_DELAY = 500

export const useScenarios = () => {
  const { organization } = useContext(OrganizationContext)
  const scenarioQuery = useVoidScenarios(organization.id)
  const deploys = useVoidDeploys(organization.id)
  const mutations = useVoidScenarioMutations(organization.id)
  const timers = useRef<Record<string, number>>({})

  const assumptions = useRef<Record<string, Assumptions> | null>(null)
  const assumptionsFor = (id: string) =>
    (assumptions.current ??= loadAssumptions())[id] ?? DEFAULT_ASSUMPTIONS

  const scenarios = useMemo(
    () =>
      (scenarioQuery.data ?? []).map((scenario) =>
        toScenario(scenario, deploys.data ?? [], assumptionsFor(scenario.id)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenarioQuery.data, deploys.data],
  )

  return useMemo(() => {
    const scenarioOf = (id: string) =>
      scenarioQuery.data?.find((scenario) => scenario.id === id)

    const create = async (input: NewScenario): Promise<Scenario> => {
      const scenario = await mutations.create.mutateAsync({
        name: input.name,
        base_version_id: input.basedOn.version,
      })
      return toScenario(scenario, deploys.data ?? [], DEFAULT_ASSUMPTIONS)
    }

    const duplicate = async (id: string): Promise<Scenario | undefined> => {
      const source = scenarioOf(id)
      if (!source) return undefined
      const scenario = await mutations.create.mutateAsync({
        name: `${source.name} (copy)`,
        base_version_id: source.base_version_id,
        patch: source.patch,
      })
      return toScenario(scenario, deploys.data ?? [], assumptionsFor(id))
    }

    const update = (id: string, patch: Partial<Pick<Scenario, 'name'>>) => {
      if (patch.name !== undefined) {
        mutations.update.mutate({ id, name: patch.name })
      }
    }

    const updateLevers = (
      id: string,
      mutate: (levers: ScenarioLevers) => void,
    ) => {
      const scenario = scenarioOf(id)
      if (!scenario) return
      const levers = leversFromConfiguration(
        scenario.configuration,
        assumptionsFor(id),
      )
      mutate(levers)
      if (levers.assumptions !== assumptionsFor(id)) {
        const all = (assumptions.current ??= loadAssumptions())
        all[id] = levers.assumptions
        saveAssumptions(all)
      }
      const patch = patchFromLevers(levers, scenario.base_configuration)
      if (JSON.stringify(patch) === JSON.stringify(scenario.patch)) {
        mutations.setScenario({ ...scenario })
        return
      }
      // Optimistic: reflect the edit at once, persist after typing settles.
      mutations.setScenario({
        ...scenario,
        patch,
        configuration: configurationFromLevers(
          levers,
          scenario.base_configuration,
        ),
      })
      window.clearTimeout(timers.current[id])
      timers.current[id] = window.setTimeout(() => {
        mutations.update.mutate({ id, patch })
      }, PERSIST_DELAY)
    }

    const remove = (id: string) => mutations.remove.mutate(id)

    const promote = async (id: string) => {
      await mutations.promote.mutateAsync(id)
    }

    return {
      scenarios,
      isLoading: scenarioQuery.isLoading || deploys.isLoading,
      error: scenarioQuery.error ?? deploys.error,
      create,
      duplicate,
      update,
      updateLevers,
      remove,
      promote,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios, scenarioQuery.data, deploys.data])
}
