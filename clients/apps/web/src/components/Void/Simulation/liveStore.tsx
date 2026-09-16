'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useContext, useMemo, useRef } from 'react'
import {
  useVoidBranches,
  useVoidBranchMutations,
  useVoidDeploys,
  versionLabel,
  versionLabels,
  VoidBranch,
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
  branch: VoidBranch,
  deploys: VoidDeploy[],
  assumptions: Assumptions,
): Scenario => {
  const promoted = deploys.find((d) => d.id === branch.promoted_deployment_id)
  const labels = versionLabels(deploys)
  return {
    id: branch.id,
    name: branch.name,
    basedOn: {
      version: branch.base_version_id,
      label: versionLabel(labels, branch.base_version_id),
    },
    createdAt: branch.created_at,
    updatedAt: branch.modified_at ?? branch.created_at,
    promotedAs: branch.promoted_deployment_id
      ? versionLabel(labels, promoted?.version_id ?? branch.version_id)
      : null,
    levers: leversFromConfiguration(branch.configuration, assumptions),
    baseLevers: leversFromConfiguration(branch.base_configuration, assumptions),
    patch: branch.patch,
  }
}

import { NewScenario } from './fixtureStore'

const PERSIST_DELAY = 500

export const useLiveScenarios = (enabled: boolean) => {
  const { organization } = useContext(OrganizationContext)
  const branches = useVoidBranches(organization.id, { enabled })
  const deploys = useVoidDeploys(organization.id, { enabled })
  const mutations = useVoidBranchMutations(organization.id)
  const timers = useRef<Record<string, number>>({})

  const assumptions = useRef<Record<string, Assumptions> | null>(null)
  const assumptionsFor = (id: string) =>
    (assumptions.current ??= loadAssumptions())[id] ?? DEFAULT_ASSUMPTIONS

  const scenarios = useMemo(
    () =>
      (branches.data ?? []).map((branch) =>
        toScenario(branch, deploys.data ?? [], assumptionsFor(branch.id)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branches.data, deploys.data],
  )

  return useMemo(() => {
    const branchOf = (id: string) =>
      branches.data?.find((branch) => branch.id === id)

    const create = async (input: NewScenario): Promise<Scenario> => {
      const branch = await mutations.create.mutateAsync({
        name: input.name,
        base_version_id: input.basedOn.version,
      })
      return toScenario(branch, deploys.data ?? [], DEFAULT_ASSUMPTIONS)
    }

    const duplicate = async (id: string): Promise<Scenario | undefined> => {
      const source = branchOf(id)
      if (!source) return undefined
      const branch = await mutations.create.mutateAsync({
        name: `${source.name} (copy)`,
        base_version_id: source.base_version_id,
        patch: source.patch,
      })
      return toScenario(branch, deploys.data ?? [], assumptionsFor(id))
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
      const branch = branchOf(id)
      if (!branch) return
      const levers = leversFromConfiguration(
        branch.configuration,
        assumptionsFor(id),
      )
      mutate(levers)
      if (levers.assumptions !== assumptionsFor(id)) {
        const all = (assumptions.current ??= loadAssumptions())
        all[id] = levers.assumptions
        saveAssumptions(all)
      }
      const patch = patchFromLevers(levers, branch.base_configuration)
      if (JSON.stringify(patch) === JSON.stringify(branch.patch)) {
        mutations.setBranch({ ...branch })
        return
      }
      // Optimistic: reflect the edit at once, persist after typing settles.
      mutations.setBranch({
        ...branch,
        patch,
        configuration: configurationFromLevers(
          levers,
          branch.base_configuration,
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
      isLoading: branches.isLoading || deploys.isLoading,
      error: branches.error ?? deploys.error,
      create,
      duplicate,
      update,
      updateLevers,
      remove,
      promote,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios, branches.data, deploys.data])
}
