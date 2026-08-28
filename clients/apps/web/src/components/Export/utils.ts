import { DateRange } from '@/components/Metrics/DateRangePicker'
import { getServerURL } from '@/utils/api'
import { ExportColumnConfig, ExportColumnGroup } from './ExportColumns'

export interface ExportSelection<T extends string> {
  dateRange: DateRange
  timezone: string
  columns: T[]
}

export function createExportColumnConfig<T extends string>(
  groups: readonly ExportColumnGroup<T>[],
  defaults: T[],
): ExportColumnConfig<T> {
  const all: T[] = groups.flatMap((group) =>
    group.columns.map((column) => column.value),
  )

  const labels = Object.fromEntries(
    groups.flatMap((group) =>
      group.columns.map((column) => [column.value, column.label]),
    ),
  ) as Record<T, string>

  const order = (selected: T[]): T[] =>
    all.filter((column) => selected.includes(column))

  const isDefault = (selected: T[]): boolean =>
    selected.length === defaults.length &&
    defaults.every((column) => selected.includes(column))

  const summarize = (selected: T[]): string => {
    if (selected.length === 0) return 'No fields selected'
    if (selected.length === all.length) return 'All fields'
    const ordered = order(selected)
    const shown = ordered
      .slice(0, 3)
      .map((column) => labels[column])
      .join(', ')
    return ordered.length > 3 ? `${shown} +${ordered.length - 3}` : shown
  }

  return { groups, all, labels, defaults, order, isDefault, summarize }
}

export function downloadCsvExport<T extends string>(
  endpoint: string,
  selection: ExportSelection<T>,
  buildParams: (search: URLSearchParams, selection: ExportSelection<T>) => void,
) {
  const url = new URL(getServerURL(endpoint), window.location.origin)
  buildParams(url.searchParams, selection)
  for (const column of selection.columns) {
    url.searchParams.append('columns', column)
  }
  window.open(url, '_blank')
}
