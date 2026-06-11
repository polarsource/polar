import { schemas } from '@polar-sh/client'
import type { StatusColor } from '@polar-sh/orbit'

export const PaymentStatusDisplayTitle: Record<
  schemas['PaymentStatus'],
  string
> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  failed: 'Failed',
}

export const PaymentStatusDisplayColor: Record<
  schemas['PaymentStatus'],
  StatusColor
> = {
  succeeded: 'green',
  pending: 'yellow',
  failed: 'red',
}

export const isCardPayment = (
  payment: schemas['Payment'],
): payment is schemas['CardPayment'] => payment.method === 'card'
