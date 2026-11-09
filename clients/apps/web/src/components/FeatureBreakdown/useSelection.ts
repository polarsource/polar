import { parseAsString, useQueryState } from 'nuqs'

export type SelectionKind = 'customer' | 'plan' | 'step'

export type Selection = { kind: SelectionKind; id: string }

const KINDS: SelectionKind[] = ['customer', 'plan', 'step']

// The dimension picked in a table, shown in detail in the sidebar. Kept in
// the URL as `kind:id`.
export const useSelection = () => {
  const [value, setValue] = useQueryState('selected', parseAsString)
  const separator = value?.indexOf(':') ?? -1
  const kind = value?.slice(0, separator) as SelectionKind | undefined
  const selection: Selection | null =
    value && separator > 0 && kind && KINDS.includes(kind)
      ? { kind, id: value.slice(separator + 1) }
      : null
  const select = (next: Selection | null) =>
    setValue(next ? `${next.kind}:${next.id}` : null)
  return { selection, select }
}

export const FREE_PLAN = 'free'
