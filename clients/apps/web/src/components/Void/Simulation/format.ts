import { formatCurrency } from '@polar-sh/currency'

export const usd = (cents: number) =>
  formatCurrency('statistics')(Math.round(cents / 100) * 100, 'usd')

export const signedUsd = (cents: number) =>
  `${cents > 0 ? '+' : cents < 0 ? '-' : ''}${usd(Math.abs(cents))}`

export const signedPct = (ratio: number | null) => {
  if (ratio === null) return 'new'
  const value = Math.round(ratio * 1000) / 10
  return `${value > 0 ? '+' : ''}${value}%`
}

export const deltaColor = (delta: number): 'success' | 'danger' | 'muted' =>
  delta > 0 ? 'success' : delta < 0 ? 'danger' : 'muted'

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })
