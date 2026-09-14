import { IdentityNode, IdentityTree, walk } from '../identities'
import { VoidIdentity, VoidIdentityKind } from '../types'

const WINDOW = 7

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0)

/** Daily usage in cents for a customer and everything below it. */
export const dailyUsageFor = (root: IdentityNode): number[] => {
  const days: number[] = []
  for (const node of walk(root)) {
    for (const series of Object.values(node.identity.usageSeries)) {
      series.forEach((value, day) => {
        days[day] = (days[day] ?? 0) + value
      })
    }
  }
  return days
}

export interface Mover {
  identity: VoidIdentity
  recent: number
  prior: number
  delta: number
  ratio: number | null
}

export const movers = (tree: IdentityTree): Mover[] =>
  tree.roots
    .map((root) => {
      const days = dailyUsageFor(root)
      const recent = sum(days.slice(-WINDOW))
      const prior = sum(days.slice(-WINDOW * 2, -WINDOW))
      return {
        identity: root.identity,
        recent,
        prior,
        delta: recent - prior,
        ratio: prior > 0 ? (recent - prior) / prior : null,
      }
    })
    .filter((mover) => mover.recent > 0 || mover.prior > 0)

export interface Runway {
  identity: VoidIdentity
  credits: number
  used: number
  remaining: number
  /** Days until credits run out at the last week's burn; null when idle. */
  daysLeft: number | null
}

export const runway = (
  tree: IdentityTree,
  rolled: Record<string, number>,
): Runway[] =>
  tree.roots
    .filter((root) => root.identity.credits !== null)
    .map((root) => {
      const credits = root.identity.credits ?? 0
      const used = rolled[root.identity.id]
      const remaining = Math.max(credits - used, 0)
      const burn = sum(dailyUsageFor(root).slice(-WINDOW)) / WINDOW
      return {
        identity: root.identity,
        credits,
        used,
        remaining,
        daysLeft: burn > 0 ? Math.floor(remaining / burn) : null,
      }
    })
    .sort(
      (a, b) =>
        (a.daysLeft ?? Number.POSITIVE_INFINITY) -
        (b.daysLeft ?? Number.POSITIVE_INFINITY),
    )

export interface Concentration {
  /** Top customers by usage, largest first. */
  top: { identity: VoidIdentity; usage: number; share: number }[]
  otherShare: number
  total: number
}

export const concentration = (
  tree: IdentityTree,
  rolled: Record<string, number>,
  limit: number,
): Concentration => {
  const total = sum(tree.roots.map((root) => rolled[root.identity.id]))
  const top = [...tree.roots]
    .sort((a, b) => rolled[b.identity.id] - rolled[a.identity.id])
    .slice(0, limit)
    .map((root) => ({
      identity: root.identity,
      usage: rolled[root.identity.id],
      share: total > 0 ? rolled[root.identity.id] / total : 0,
    }))
  const otherShare = Math.max(0, 1 - sum(top.map((entry) => entry.share)))
  return { top, otherShare, total }
}

export interface KindShare {
  kind: VoidIdentityKind
  count: number
  usage: number
  share: number
}

export const makeup = (identities: VoidIdentity[]): KindShare[] => {
  const total = sum(identities.map((identity) => identity.usage))
  const kinds: VoidIdentityKind[] = ['human', 'agent', 'service']
  return kinds.map((kind) => {
    const members = identities.filter((identity) => identity.kind === kind)
    const usage = sum(members.map((identity) => identity.usage))
    return {
      kind,
      count: members.length,
      usage,
      share: total > 0 ? usage / total : 0,
    }
  })
}
