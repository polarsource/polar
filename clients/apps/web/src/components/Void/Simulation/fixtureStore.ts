'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { blankScenario, PRESET_SCENARIOS, PROMOTED_VERSION } from './fixtures'
import { Scenario, ScenarioLevers } from './types'

const STORAGE_KEY = 'void-simulation-scenarios'

let state: Scenario[] | null = null
const listeners = new Set<() => void>()

const load = (): Scenario[] | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Scenario[]) : null
    // Scenarios saved before the branch integration lack the base levers.
    return parsed?.every((scenario) => scenario.baseLevers && scenario.patch)
      ? parsed
      : null
  } catch {
    return null
  }
}

const persist = (scenarios: Scenario[]) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios))
  } catch {
    // Storage may be unavailable; the session still works in memory.
  }
}

const getSnapshot = () => (state ??= load() ?? PRESET_SCENARIOS)
const getServerSnapshot = () => PRESET_SCENARIOS
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const commit = (next: Scenario[]) => {
  state = next
  persist(next)
  listeners.forEach((listener) => listener())
}

const touch = (scenario: Scenario): Scenario => ({
  ...scenario,
  updatedAt: new Date().toISOString(),
})

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export type NewScenario = Pick<Scenario, 'name' | 'basedOn'>

const create = async (input: NewScenario): Promise<Scenario> => {
  const id = `${slugify(input.name) || 'scenario'}-${Date.now().toString(36)}`
  const scenario = { ...blankScenario(id, input.name), ...input }
  commit([scenario, ...getSnapshot()])
  return scenario
}

const duplicate = async (id: string): Promise<Scenario | undefined> => {
  const source = getSnapshot().find((scenario) => scenario.id === id)
  if (!source) return undefined
  const copy: Scenario = {
    ...structuredClone(source),
    id: `${source.id}-copy-${Date.now().toString(36)}`,
    name: `${source.name} (copy)`,
    promotedAs: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  commit([copy, ...getSnapshot()])
  return copy
}

const update = (id: string, patch: Partial<Pick<Scenario, 'name'>>) => {
  commit(
    getSnapshot().map((scenario) =>
      scenario.id === id ? touch({ ...scenario, ...patch }) : scenario,
    ),
  )
}

const updateLevers = (id: string, mutate: (levers: ScenarioLevers) => void) => {
  commit(
    getSnapshot().map((scenario) => {
      if (scenario.id !== id) return scenario
      const levers = structuredClone(scenario.levers)
      mutate(levers)
      return touch({ ...scenario, levers })
    }),
  )
}

const remove = (id: string) => {
  commit(getSnapshot().filter((scenario) => scenario.id !== id))
}

const promote = async (id: string) => {
  update(id, {})
  commit(
    getSnapshot().map((scenario) =>
      scenario.id === id
        ? touch({ ...scenario, promotedAs: PROMOTED_VERSION })
        : scenario,
    ),
  )
}

export const useFixtureScenarios = () => {
  const scenarios = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )
  return useMemo(
    () => ({
      scenarios,
      isLoading: false,
      error: null,
      create,
      duplicate,
      update,
      updateLevers,
      remove,
      promote,
    }),
    [scenarios],
  )
}
