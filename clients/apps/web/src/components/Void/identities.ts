import { VoidIdentity } from './types'

export interface IdentityNode {
  identity: VoidIdentity
  children: IdentityNode[]
  depth: number
}

export interface IdentityTree {
  roots: IdentityNode[]
  byId: Map<string, IdentityNode>
}

export const buildTree = (identities: VoidIdentity[]): IdentityTree => {
  const byId = new Map<string, IdentityNode>()
  for (const identity of identities) {
    byId.set(identity.id, { identity, children: [], depth: 0 })
  }
  const roots: IdentityNode[] = []
  for (const node of byId.values()) {
    const parent = node.identity.parent_id
      ? byId.get(node.identity.parent_id)
      : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const setDepth = (node: IdentityNode, depth: number) => {
    node.depth = depth
    for (const child of node.children) setDepth(child, depth + 1)
  }
  for (const root of roots) setDepth(root, 0)
  return { roots, byId }
}

/** Self first, root last. */
export const chainOf = (tree: IdentityTree, id: string): VoidIdentity[] => {
  const chain: VoidIdentity[] = []
  for (
    let node = tree.byId.get(id);
    node;
    node = tree.byId.get(node.identity.parent_id ?? '')
  ) {
    chain.push(node.identity)
  }
  return chain
}

export const walk = (node: IdentityNode): IdentityNode[] => [
  node,
  ...node.children.flatMap(walk),
]

/** Own usage plus every descendant's, keyed by identity id. */
export const rollupUsage = (tree: IdentityTree): Record<string, number> => {
  const rolled: Record<string, number> = {}
  const visit = (node: IdentityNode): number => {
    const total =
      node.identity.usage +
      node.children.reduce((sum, child) => sum + visit(child), 0)
    rolled[node.identity.id] = total
    return total
  }
  for (const root of tree.roots) visit(root)
  return rolled
}

export const describeKinds = (identities: VoidIdentity[]): string => {
  const counts = new Map<string, number>()
  for (const identity of identities) {
    counts.set(identity.kind, (counts.get(identity.kind) ?? 0) + 1)
  }
  return [...counts]
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`)
    .join(', ')
}

export const rootIdentities = (identities: VoidIdentity[]) =>
  identities.filter((identity) => identity.parent_id === null)

export const topSpenders = (identities: VoidIdentity[]) =>
  rootIdentities(identities)
    .filter((identity) => identity.spend > 0)
    .sort((a, b) => b.spend - a.spend)

export const shortDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
