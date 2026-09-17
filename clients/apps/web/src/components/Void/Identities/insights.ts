import { IdentityNode, IdentityRef, IdentityTree, walk } from '../identities'
import { VoidIdentity, VoidIdentityKind } from '../types'

const WINDOW = 7

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0)

/** Daily usage in cents for a customer and everything below it. */
export const dailyUsageFor = (
  root: IdentityNode<IdentityRef>,
  cadence?: Record<string, number[]>,
): number[] => {
  const days: number[] = []
  if (cadence) {
    for (const node of walk(root)) {
      const own = cadence[node.identity.id]
      if (!own) continue
      own.forEach((value, day) => {
        days[day] = (days[day] ?? 0) + value
      })
    }
    return days
  }
  for (const node of walk(root)) {
    if (!('usageSeries' in node.identity)) continue
    for (const series of Object.values(
      (node.identity as VoidIdentity).usageSeries,
    )) {
      series.forEach((value, day) => {
        days[day] = (days[day] ?? 0) + value
      })
    }
  }
  return days
}

export interface Mover<T extends { id: string; name: string } = VoidIdentity> {
  identity: T
  recent: number
  prior: number
  delta: number
  ratio: number | null
}

export const movers = <T extends IdentityRef & { name: string }>(
  tree: IdentityTree<T>,
  cadence?: Record<string, number[]>,
): Mover<T>[] =>
  tree.roots
    .map((root) => {
      const days = dailyUsageFor(root, cadence)
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

export interface Concentration<T extends IdentityRef = VoidIdentity> {
  /** Top customers by usage, largest first. */
  top: { identity: T; usage: number; share: number }[]
  otherShare: number
  total: number
}

export const concentration = <T extends IdentityRef>(
  tree: IdentityTree<T>,
  rolled: Record<string, number>,
  limit: number,
): Concentration<T> => {
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
  kind: string
  count: number
  usage: number
  share: number
}

export const kindMakeup = (
  identities: { id: string; kind: string }[],
  usage?: Record<string, number>,
): KindShare[] => {
  const counts = new Map<string, { count: number; usage: number }>()
  for (const identity of identities) {
    const current = counts.get(identity.kind) ?? { count: 0, usage: 0 }
    current.count += 1
    current.usage += usage?.[identity.id] ?? 0
    counts.set(identity.kind, current)
  }
  const totalUsage = sum([...counts.values()].map((entry) => entry.usage))
  const total = usage ? totalUsage : identities.length
  return [...counts].map(([kind, entry]) => ({
    kind,
    count: entry.count,
    usage: entry.usage,
    share: total > 0 ? (usage ? entry.usage : entry.count) / total : 0,
  }))
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
