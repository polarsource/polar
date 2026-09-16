import { VoidEvent, VoidIdentityKind, VoidMeter, VoidPlan } from './types'

export const ROOTS: [string, VoidIdentityKind, number][] = [
  ['Northwind Labs', 'human', 412_800],
  ['Halcyon Robotics', 'human', 298_400],
  ['Aperture Analytics', 'human', 187_200],
  ['Brightline Media', 'human', 142_600],
  ['Sable Systems', 'human', 96_300],
  ['Orbital Foods', 'human', 74_100],
  ['Meridian Health', 'human', 51_900],
  ['Kestrel Games', 'human', 38_200],
  ['Tidewater Finance', 'human', 0],
  ['Lumen Studio', 'human', 0],
  ['Fairweather Co', 'human', 0],
  ['Pinecrest Logistics', 'human', 12_400],
]

export const CHILD_NAMES = [
  'deploy-bot',
  'support-agent',
  'nightly-indexer',
  'billing-service',
  'research-agent',
]

export const EVENT_NAMES: [string, VoidEvent['source']][] = [
  ['llm.completion', 'user'],
  ['tool.call', 'user'],
  ['subscription.renewed', 'system'],
  ['order.paid', 'system'],
  ['meter.credited', 'system'],
  ['llm.completion', 'user'],
  ['sandbox.started', 'user'],
  ['tool.call', 'user'],
  ['llm.completion', 'user'],
  ['meter.balance_low', 'system'],
  ['llm.completion', 'user'],
  ['sandbox.stopped', 'user'],
]

export const NOTES: Record<string, string> = {
  ident_1: 'Enterprise pilot, invoiced quarterly',
  ident_2: 'Migrated from legacy metering in v12',
  ident_1_1: 'Runs the nightly release pipeline',
  ident_3_1: 'Handles tier-1 support tickets',
}

export const METERS: VoidMeter[] = [
  { id: 'meter_1', name: 'Output tokens', units: 184_200_000, billed: 552_600 },
  { id: 'meter_2', name: 'Input tokens', units: 612_000_000, billed: 306_000 },
  { id: 'meter_3', name: 'Tool calls', units: 1_240_000, billed: 124_000 },
  { id: 'meter_4', name: 'Sandbox minutes', units: 38_400, billed: 76_800 },
]

export const PLANS: VoidPlan[] = [
  { name: 'Scale', active: 41, mrr: 405_900 },
  { name: 'Team', active: 63, mrr: 189_000 },
  { name: 'Starter', active: 22, mrr: 21_800 },
]
