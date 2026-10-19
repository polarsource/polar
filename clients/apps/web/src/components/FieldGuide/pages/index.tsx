import type { ReactNode } from 'react'
import { agentOps } from './agents'
import { marginCheck } from './check'
import { delegation } from './identities'
import { branchReplay, simulationCompare } from './simulations'
import { cover } from './cover'
import { fold } from './fold'
import { marginFloor, signals } from './guardrails'
import { igloo } from './igloo'
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
  /** The line under the title. */
  sub?: string
  /** The column beside the figure: a heading, then its paragraphs. */
  notes?: Notes
  /** The drawing alone. The title, its line and the notes are set beside it as text. */
  render: () => ReactNode
}

export type Notes = [string, string[]][]

/** The book, in reading order: the front matter, then the chapters, each with its pages. */
export const chapters: { title: string; ids: string[] }[] = [
  {
    title: 'Front matter',
    ids: ['cover', 'm-contents'],
  },
  { title: '00 · Principles', ids: ['m-principle', 'm-agents'] },
  { title: '01 · Billing as code', ids: ['m-code', 'm-cli', 'm-check'] },
  {
    title: '02 · Events',
    ids: ['m-event', 'm-ledger', 'm-ingest'],
  },
  {
    title: '03 · Meters',
    ids: ['m-meter', 'm-fold', 'm-tiers'],
  },
  { title: '04 · Local-first', ids: ['m-igloo', 'm-latency', 'm-reconcile'] },
  { title: '05 · Guardrails', ids: ['m-signals', 'm-margin'] },
  { title: '06 · Simulations', ids: ['m-branch', 'm-compare'] },
  { title: '07 · Credits', ids: ['m-credits', 'm-grants', 'm-zero'] },
  { title: '08 · Entitlements', ids: ['m-gates', 'm-flow', 'm-entitlements'] },
  { title: '09 · Identities', ids: ['m-nesting', 'm-delegate'] },
]
const ORDER = chapters.flatMap((c) => c.ids)
const all = [
  delegation,
  branchReplay,
  simulationCompare,
  agentOps,
  cover,
  marginCheck,
  fold,
  igloo,
  signals,
  marginFloor,
  ...manual,
  ...more,
]
export const pieces: Piece[] = ORDER.map((id) => {
  const p = all.find((x) => x.id === id)
  if (!p) throw new Error(`No page ${id}`)
  return p
})
