import type { IrProductMeter } from '@void/sdk/config'

/**
 * A browser-side model of an identity tree on one meter. Usage recorded on
 * an identity counts for every ancestor; a holder's credits cover its whole
 * subtree; caps and feature lists narrow what a subtree inherits. A check
 * walks the chain from the actor to the root and the tightest holder wins.
 */

export interface TreeNode {
  readonly id: string
  readonly parent: string | null
  /** What this identity itself recorded this period. */
  readonly usage: number
  /** A cap on the meter for this subtree; undefined inherits, null lifts. */
  readonly cap?: number | null
  /** Explicit feature list; undefined inherits the parent's, empty denies all. */
  readonly features?: readonly string[]
}

export interface Holder {
  readonly id: string
  readonly term: IrProductMeter
  readonly features: readonly string[]
}

export interface Tree {
  readonly nodes: readonly TreeNode[]
  readonly holder: Holder
}

const node = (tree: Tree, id: string) => tree.nodes.find((n) => n.id === id)

export const children = (tree: Tree, id: string) =>
  tree.nodes.filter((n) => n.parent === id)

export const chain = (tree: Tree, id: string): string[] => {
  const out: string[] = []
  let current: string | null = id
  while (current !== null) {
    out.push(current)
    current = node(tree, current)?.parent ?? null
  }
  return out
}

export const subtreeUsage = (tree: Tree, id: string): number =>
  (node(tree, id)?.usage ?? 0) +
  children(tree, id).reduce(
    (sum, child) => sum + subtreeUsage(tree, child.id),
    0,
  )

export const features = (tree: Tree, id: string): readonly string[] => {
  const own = node(tree, id)
  if (own?.features !== undefined) return own.features
  if (own?.parent) return features(tree, own.parent)
  return id === tree.holder.id ? tree.holder.features : []
}

export interface ChainStep {
  readonly id: string
  readonly kind: 'holder' | 'cap' | 'inherits'
  readonly remaining: number | null
}

export interface TreeCheck {
  readonly id: string
  readonly estimate: number
  readonly steps: readonly ChainStep[]
  readonly allowed: boolean
  readonly limitedBy: string | null
  readonly remaining: number | null
  readonly reason: 'ok' | 'cap' | 'no_plan'
}

export const check = (tree: Tree, id: string, estimate: number): TreeCheck => {
  const steps = chain(tree, id).map((current): ChainStep => {
    const own = node(tree, current)
    const used = subtreeUsage(tree, current)
    if (own?.cap !== undefined && own.cap !== null)
      return {
        id: current,
        kind: 'cap',
        remaining: Math.max(0, own.cap - used),
      }
    if (current === tree.holder.id)
      return {
        id: current,
        kind: 'holder',
        remaining:
          tree.holder.term.limit === 'unlimited'
            ? null
            : Math.max(0, tree.holder.term.included - used),
      }
    return { id: current, kind: 'inherits', remaining: null }
  })
  const limiting = steps.filter((step) => step.kind !== 'inherits')
  if (limiting.length === 0)
    return {
      id,
      estimate,
      steps,
      allowed: false,
      limitedBy: null,
      remaining: null,
      reason: 'no_plan',
    }
  const tightest = limiting.reduce((best, step) =>
    step.remaining !== null &&
    (best.remaining === null || step.remaining < best.remaining)
      ? step
      : best,
  )
  const soft = tightest.kind === 'holder' && tree.holder.term.limit !== 'hard'
  const denied =
    !soft && tightest.remaining !== null && tightest.remaining < estimate
  return {
    id,
    estimate,
    steps,
    allowed: !denied,
    limitedBy: tightest.id,
    remaining: tightest.remaining,
    reason: denied ? 'cap' : 'ok',
  }
}
