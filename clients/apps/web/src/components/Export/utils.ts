import { DateRange } from '@/components/Metrics/DateRangePicker'
import { toast } from '@/components/Toast/use-toast'
import { getServerURL } from '@/utils/api'
import { API_VERSION } from '@polar-sh/client'
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

  const order = (selected: T[]): T[] => {
    const selectedColumns = new Set(selected)
    return all.filter((column) => selectedColumns.has(column))
  }

  const isDefault = (selected: T[]): boolean => {
    const selectedColumns = new Set(selected)
    return (
      selected.length === defaults.length &&
      defaults.every((column) => selectedColumns.has(column))
    )
  }

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
  return downloadExport(url, `polar-${endpoint.split('/')[2]}.csv`)
}

// fetch instead of window.open: versioned query params need the Polar-Version header
export async function downloadExport(url: URL, filename: string) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Polar-Version': API_VERSION },
  }).catch(() => null)
  const blob = response?.ok ? await response.blob().catch(() => null) : null
  if (!response || !blob) {
    toast({ title: 'Export failed', description: 'Please try again later' })
    return
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download =
    response.headers
      .get('Content-Disposition')
      ?.match(/filename="([^"]+)"/)?.[1] ?? filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href))
}
