// Selection scales past one page with a Gmail-style model: either everything is
// selected except `toggled` (mode `all`, the opt-out default), or nothing is
// selected except `toggled` (mode `none`). Row ids never all live client-side,
// so we never enumerate them.
export type SelectionMode = 'all' | 'none'

export interface SelectionState {
  mode: SelectionMode
  toggled: Set<string>
}

export type HeaderCheckState = 'checked' | 'unchecked' | 'indeterminate'

export const initialSelection: SelectionState = {
  mode: 'all',
  toggled: new Set(),
}

export function isRowSelected(state: SelectionState, id: string): boolean {
  return state.mode === 'all' ? !state.toggled.has(id) : state.toggled.has(id)
}

export function selectedCount(
  state: SelectionState,
  importableTotal: number,
): number {
  const count =
    state.mode === 'all'
      ? importableTotal - state.toggled.size
      : state.toggled.size
  return Math.max(0, count)
}

export function headerCheckState(state: SelectionState): HeaderCheckState {
  if (state.toggled.size === 0) {
    return state.mode === 'all' ? 'checked' : 'unchecked'
  }
  return 'indeterminate'
}

export function toggleRow(state: SelectionState, id: string): SelectionState {
  const toggled = new Set(state.toggled)
  if (toggled.has(id)) {
    toggled.delete(id)
  } else {
    toggled.add(id)
  }
  return { ...state, toggled }
}

export function toggleAll(state: SelectionState): SelectionState {
  const allSelected = state.mode === 'all' && state.toggled.size === 0
  return { mode: allSelected ? 'none' : 'all', toggled: new Set() }
}

export function importPayload(state: SelectionState): {
  recordIds?: string[]
  excludeRecordIds?: string[]
} {
  if (state.mode === 'all') {
    return state.toggled.size ? { excludeRecordIds: [...state.toggled] } : {}
  }
  return { recordIds: [...state.toggled] }
}
