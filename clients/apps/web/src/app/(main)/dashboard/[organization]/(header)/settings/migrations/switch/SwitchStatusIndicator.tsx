import { Status } from '@polar-sh/orbit'
import { SwitchRow } from './switchRows'
import { switchStatus } from './switchStatus'

// The switch outcome as both the table cell and the detail modal show it, so
// the two can't drift apart.
export function SwitchStatusIndicator({ row }: { row: SwitchRow }) {
  const { label, color } = switchStatus(row)
  return <Status status={label} color={color} size="small" />
}
