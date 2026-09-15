import { schemas } from '@polar-sh/client'
import { BASELINE_LEVERS } from './baseline'
import { ScenarioLevers } from './types'

export type SimulationChange = schemas['SimulationChange']

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Applies Compass-proposed changes to a set of levers by name. Changes that
 * name a plan or meter the definition does not have are skipped, and the
 * skipped names are returned so the UI can say so.
 */
export const applyChanges = (
  levers: ScenarioLevers,
  changes: SimulationChange[],
): string[] => {
  const unmatched: string[] = []
  for (const change of changes) {
    if (change.kind === 'meter_price') {
      const meter = levers.meters.find((m) => sameName(m.name, change.name))
      if (!meter) {
        unmatched.push(change.name)
        continue
      }
      meter.price = change.amount
      continue
    }
    const plan = levers.plans.find((p) => sameName(p.name, change.name))
    if (!plan) {
      unmatched.push(change.name)
      continue
    }
    if (change.kind === 'plan_price') plan.monthlyPrice = change.amount
    else plan.includedUsage = change.amount
  }
  return unmatched
}

export const describeChange = (change: SimulationChange): string => {
  const amount = `$${(change.amount / 100).toLocaleString('en-US')}`
  switch (change.kind) {
    case 'plan_price':
      return `${change.name} price ${amount} / mo`
    case 'plan_allowance':
      return `${change.name} allowance ${amount}`
    case 'meter_price': {
      const meter = BASELINE_LEVERS.meters.find((m) =>
        sameName(m.name, change.name),
      )
      return `${change.name} ${amount} / ${meter?.unit ?? 'unit'}`
    }
  }
}
