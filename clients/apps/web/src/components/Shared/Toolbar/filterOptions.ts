import { type FilterOption } from '@/components/Shared/FilterPopover'

// Keeps the first of each value. Selected options are listed ahead of the
// found ones, and a row that shifts between pages can come back twice.
export const uniqueOptions = (options: FilterOption[]): FilterOption[] => {
  const seen = new Set<string>()
  return options.filter(({ value }) => {
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}
