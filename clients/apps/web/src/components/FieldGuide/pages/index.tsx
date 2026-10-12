import type { ReactNode } from 'react'
import { cover } from './cover'
import { manual } from './manual'
import { more } from './more'

export type Kind = 'manual'

export interface Piece {
  id: string
  title: string
  kind: Kind
  /** What it is, and what it is built from. Shown in the lightbox. */
  note: string
  /** Design size; the grid and the lightbox scale it. */
  w: number
  h: number
  /** Columns in the grid, of three. */
  cols: 1 | 2
  render: () => ReactNode
}

/** The book, in reading order: the cover, the contents, then the chapters. */
const ORDER = [
  'cover',
  'm-contents',
  'm-principle',
  'm-code',
  'm-cli',
  'm-env',
  'm-event',
  'm-ledger',
  'm-ingest',
  'm-replay',
  'm-meter',
  'm-latency',
  'm-tiers',
  'm-reconcile',
  'm-credits',
  'm-grants',
  'm-zero',
  'm-invoice',
  'm-usage',
  'm-proration',
  'm-gates',
  'm-flow',
  'm-benefits',
  'm-nesting',
  'm-keys',
  'm-ask',
  'm-catalogue',
  'm-api',
  'm-glossary',
]
const all = [cover, ...manual, ...more]
export const pieces: Piece[] = ORDER.map((id) => {
  const p = all.find((x) => x.id === id)
  if (!p) throw new Error(`No page ${id}`)
  return p
})
