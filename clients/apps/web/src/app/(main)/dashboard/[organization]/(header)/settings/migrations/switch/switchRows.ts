import { schemas } from '@polar-sh/client'

export type SwitchRow = schemas['MerchantMigrationRecordItem']
export type SwitchCutoverStatus = schemas['MerchantMigrationCutoverStatus']

export function isSwitched(row: SwitchRow): boolean {
  return row.cutover_status === 'moved'
}

export function isSwitchable(row: SwitchRow): boolean {
  const dependenciesReady =
    row.import_status === 'imported' ||
    (row.import_status === 'pending' && row.dependencies_imported === true)
  return (
    row.record_id != null && dependenciesReady && row.cutover_status !== 'moved'
  )
}

export function needsAttention(row: SwitchRow): boolean {
  return row.cutover_status === 'skipped' || row.cutover_status === 'failed'
}

const INTERVAL_ABBREVIATION: Record<string, string> = {
  day: '/day',
  week: '/wk',
  month: '/mo',
  year: '/yr',
}

export function intervalAbbreviation(interval: string | null): string | null {
  if (!interval) return null
  return INTERVAL_ABBREVIATION[interval] ?? null
}
