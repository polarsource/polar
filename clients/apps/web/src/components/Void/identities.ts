import { VoidIdentity } from './types'

export interface IdentityRef {
  id: string
  parent_id: string | null
}

export interface IdentityNode<T extends IdentityRef = VoidIdentity> {
  identity: T
  children: IdentityNode<T>[]
  depth: number
}

export interface IdentityTree<T extends IdentityRef = VoidIdentity> {
  roots: IdentityNode<T>[]
  byId: Map<string, IdentityNode<T>>
}

export const identityPath = (externalId: string) =>
  externalId.split('/').map(encodeURIComponent).join('/')

export const identityHref = (base: string, externalId: string) =>
  `${base}/identities/${identityPath(externalId)}`

export const identityIdFromPath = (path: string) =>
  path
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join('/')

export const buildTree = <T extends IdentityRef>(
  identities: T[],
): IdentityTree<T> => {
  const byId = new Map<string, IdentityNode<T>>()
  for (const identity of identities) {
    byId.set(identity.id, { identity, children: [], depth: 0 })
  }
  const roots: IdentityNode<T>[] = []
  for (const node of byId.values()) {
    const parent = node.identity.parent_id
      ? byId.get(node.identity.parent_id)
      : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const setDepth = (node: IdentityNode<T>, depth: number) => {
    node.depth = depth
    for (const child of node.children) setDepth(child, depth + 1)
  }
  for (const root of roots) setDepth(root, 0)
  return { roots, byId }
}

/** Self first, root last. */
export const chainOf = <T extends IdentityRef>(
  tree: IdentityTree<T>,
  id: string,
): T[] => {
  const chain: T[] = []
  for (
    let node = tree.byId.get(id);
    node;
    node = tree.byId.get(node.identity.parent_id ?? '')
  ) {
    chain.push(node.identity)
  }
  return chain
}

export const walk = <T extends IdentityRef>(
  node: IdentityNode<T>,
): IdentityNode<T>[] => [node, ...node.children.flatMap(walk)]

export type IdentityListFilter =
  | 'all'
  | 'customer'
  | 'human'
  | 'agent'
  | 'service'

type ListedIdentity = IdentityRef & {
  name: string
  kind: string
  created_at: string
}

export const identityMatches = (
  identity: ListedIdentity,
  filter: IdentityListFilter,
  needle: string,
): boolean => {
  const kindOk =
    filter === 'all' ||
    (filter === 'customer'
      ? identity.parent_id === null
      : identity.kind === filter)
  if (!kindOk) return false
  if (!needle) return true
  return `${identity.name} ${identity.kind}`.toLowerCase().includes(needle)
}

export const pruneIdentityForest = <T extends IdentityRef>(
  nodes: IdentityNode<T>[],
  keep: (node: IdentityNode<T>) => boolean,
): IdentityNode<T>[] => {
  const visit = (node: IdentityNode<T>): IdentityNode<T> | null => {
    const children = node.children.flatMap((child) => {
      const next = visit(child)
      return next ? [next] : []
    })
    if (!keep(node) && children.length === 0) return null
    return { ...node, children }
  }
  return nodes.flatMap((node) => {
    const next = visit(node)
    return next ? [next] : []
  })
}

export const sortIdentityForest = <T extends ListedIdentity>(
  nodes: IdentityNode<T>[],
  rootOrder: 'newest' | 'oldest',
): IdentityNode<T>[] => {
  const byName = (a: IdentityNode<T>, b: IdentityNode<T>) =>
    a.identity.name.localeCompare(b.identity.name)
  const byCreated = (a: IdentityNode<T>, b: IdentityNode<T>) => {
    const diff =
      new Date(b.identity.created_at).getTime() -
      new Date(a.identity.created_at).getTime()
    return rootOrder === 'newest' ? diff : -diff
  }
  const sortLevel = (
    list: IdentityNode<T>[],
    compare: (a: IdentityNode<T>, b: IdentityNode<T>) => number,
  ): IdentityNode<T>[] =>
    list
      .map((node) => ({ ...node, children: sortLevel(node.children, byName) }))
      .toSorted(compare)
  return sortLevel(nodes, byCreated)
}

export const visibleIdentityForest = <T extends ListedIdentity>(
  tree: IdentityTree<T>,
  filter: IdentityListFilter,
  needle: string,
  sorting: 'newest' | 'oldest',
): IdentityNode<T>[] =>
  sortIdentityForest(
    pruneIdentityForest(tree.roots, (node) =>
      identityMatches(node.identity, filter, needle),
    ),
    sorting,
  )

export const autoExpandedIdentityIds = <T extends IdentityRef>(
  tree: IdentityTree<T>,
  selectedId: string | null,
  forest: IdentityNode<T>[],
  expandVisibleBranches: boolean,
): Set<string> => {
  const ids = new Set<string>()
  if (selectedId) {
    for (const item of chainOf(tree, selectedId)) ids.add(item.id)
  }
  if (expandVisibleBranches) {
    const visit = (node: IdentityNode<T>) => {
      if (node.children.length > 0) ids.add(node.identity.id)
      for (const child of node.children) visit(child)
    }
    for (const root of forest) visit(root)
  }
  return ids
}

export const rollup = <T extends IdentityRef>(
  tree: IdentityTree<T>,
  own: Record<string, number>,
): Record<string, number> => {
  const rolled: Record<string, number> = {}
  const visit = (node: IdentityNode<T>): number => {
    const total =
      (own[node.identity.id] ?? 0) +
      node.children.reduce((sum, child) => sum + visit(child), 0)
    rolled[node.identity.id] = total
    return total
  }
  for (const root of tree.roots) visit(root)
  return rolled
}

export const describeKinds = (identities: { kind: string }[]): string => {
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
