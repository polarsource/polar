import { Status } from '@polar-sh/orbit'
import { SwitchRow } from './switchRows'
import { switchStatus } from './switchStatus'

export function SwitchStatusIndicator({ row }: { row: SwitchRow }) {
  const { label, color } = switchStatus(row)
  return <Status status={label} color={color} size="small" />
}
