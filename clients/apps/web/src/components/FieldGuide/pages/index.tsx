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

/** The book, in reading order: the front matter, then the chapters, each with its pages. */
export const chapters: { title: string; ids: string[] }[] = [
  { title: 'Front matter', ids: ['cover', 'm-contents', 'm-principle'] },
  { title: '01 · Billing as code', ids: ['m-code', 'm-cli', 'm-env'] },
  {
    title: '02 · Events',
    ids: ['m-event', 'm-ledger', 'm-ingest', 'm-replay'],
  },
  {
    title: '03 · Meters',
    ids: ['m-meter', 'm-latency', 'm-tiers', 'm-reconcile'],
  },
  { title: '04 · Credits', ids: ['m-credits', 'm-grants', 'm-zero'] },
  { title: '05 · Invoices', ids: ['m-invoice', 'm-usage', 'm-proration'] },
  { title: '06 · Entitlements', ids: ['m-gates', 'm-flow', 'm-benefits'] },
  { title: '07 · Agents', ids: ['m-nesting', 'm-keys', 'm-ask'] },
  { title: 'Appendix', ids: ['m-catalogue', 'm-api', 'm-glossary'] },
]
const ORDER = chapters.flatMap((c) => c.ids)
const all = [cover, ...manual, ...more]
export const pieces: Piece[] = ORDER.map((id) => {
  const p = all.find((x) => x.id === id)
  if (!p) throw new Error(`No page ${id}`)
  return p
})
