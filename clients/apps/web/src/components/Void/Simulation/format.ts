import { formatCurrency } from '@polar-sh/currency'

export const usd = (cents: number) =>
  formatCurrency('statistics')(Math.round(cents / 100) * 100, 'usd')

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })
