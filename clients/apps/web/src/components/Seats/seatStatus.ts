import { schemas } from '@polar-sh/client'
import { type StatusColor } from '@polar-sh/orbit'

export const seatStatusDisplayConfig: Record<
  schemas['SeatStatus'],
  [string, StatusColor]
> = {
  pending: ['Pending', 'yellow'],
  claimed: ['Claimed', 'green'],
  revoked: ['Revoked', 'gray'],
}
