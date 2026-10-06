import type { ComponentType } from 'react'
import { BenefitsPoster } from './BenefitsPoster'
import { AgentsPoster, DerivedPoster, LatencyPoster } from './EthosPoster'
import { FigurePoster } from './FigurePoster'
import { GridPoster } from './GridPoster'
import { LabelsPoster } from './LabelsPoster'
import { LedgerPoster } from './LedgerPoster'
import { OrbitPoster } from './OrbitPoster'
import { StackPoster } from './StackPoster'
import { StatementPoster } from './StatementPoster'
import { SurfacesPoster } from './SurfacesPoster'
import { ArithmeticPoster } from './ArithmeticPoster'
import { EventPoster, MeterPoster, StreamPoster } from './story/ActSignal'
import { CreditsPoster, MarginPoster, RatePoster } from './story/ActPrice'
import { InvoicePoster, SellerPoster, TaxPoster } from './story/ActInvoice'
import {
  BalancePoster,
  PayoutPoster,
  SettlementPoster,
} from './story/ActSettle'
import {
  AgentPoster,
  ClosingPoster,
  InsightPoster,
} from './story/ActUnderstand'
import { TracePoster } from './TracePoster'
import { UnitsPoster } from './UnitsPoster'
import { WavePoster } from './WavePoster'
import { WebhooksPoster } from './WebhooksPoster'
import { GrowthPoster } from './GrowthPoster'

export interface Sheet {
  caption: string
  Poster: ComponentType
}

export interface Board {
  /** Act label for the narrative boards; the system boards carry none. */
  act?: { numeral: string; title: string; lead: string }
  sheets: Sheet[]
}

/** The system: sheets that show the parts, three to a board. */
export const SYSTEM_BOARDS: Board[] = [
  {
    sheets: [
      { caption: 'Grid, usage billing', Poster: GridPoster },
      { caption: 'Route, platform', Poster: TracePoster },
      { caption: 'Statement, platform', Poster: StatementPoster },
    ],
  },
  {
    sheets: [
      { caption: 'Figure, usage billing', Poster: FigurePoster },
      { caption: 'Stack, lifecycle', Poster: StackPoster },
      { caption: 'Orbit, brand', Poster: OrbitPoster },
    ],
  },
  {
    sheets: [
      { caption: 'Ledger, events', Poster: LedgerPoster },
      { caption: 'Units, pricing', Poster: UnitsPoster },
      { caption: 'Labels, platform', Poster: LabelsPoster },
    ],
  },
  {
    sheets: [
      { caption: 'Growth, usage billing', Poster: GrowthPoster },
      { caption: 'Wave, usage billing', Poster: WavePoster },
      { caption: 'Arithmetic, usage billing', Poster: ArithmeticPoster },
    ],
  },
  {
    sheets: [
      { caption: 'Benefits, entitlements', Poster: BenefitsPoster },
      { caption: 'Webhooks, events out', Poster: WebhooksPoster },
      { caption: 'Surfaces, four ways in', Poster: SurfacesPoster },
    ],
  },
  {
    sheets: [
      { caption: 'Ethos I, derived', Poster: DerivedPoster },
      { caption: 'Ethos II, zero latency', Poster: LatencyPoster },
      { caption: 'Ethos III, built for agents', Poster: AgentsPoster },
    ],
  },
]

/** The story: one event followed from the wire to the payout, in five acts. */
export const STORY_BOARDS: Board[] = [
  {
    act: { numeral: 'I', title: 'Signal', lead: 'An event arrives.' },
    sheets: [
      { caption: 'Event, one request', Poster: EventPoster },
      { caption: 'Stream, a million more', Poster: StreamPoster },
      { caption: 'Meter, a number', Poster: MeterPoster },
    ],
  },
  {
    act: { numeral: 'II', title: 'Price', lead: 'The number becomes money.' },
    sheets: [
      { caption: 'Rate, per token', Poster: RatePoster },
      { caption: 'Credits, prepaid', Poster: CreditsPoster },
      { caption: 'Margin, cost to serve', Poster: MarginPoster },
    ],
  },
  {
    act: { numeral: 'III', title: 'Invoice', lead: 'The money is asked for.' },
    sheets: [
      { caption: 'Invoice, assembled', Poster: InvoicePoster },
      { caption: 'Tax, wherever they are', Poster: TaxPoster },
      { caption: 'Merchant of record, who carries what', Poster: SellerPoster },
    ],
  },
  {
    act: { numeral: 'IV', title: 'Settle', lead: 'The money moves.' },
    sheets: [
      { caption: 'Payout, down to the fee', Poster: PayoutPoster },
      { caption: 'Settlement, who gets what', Poster: SettlementPoster },
      { caption: 'Books, one invoice', Poster: BalancePoster },
    ],
  },
  {
    act: {
      numeral: 'V',
      title: 'Understand',
      lead: 'And you learn something.',
    },
    sheets: [
      { caption: 'Insight, margin by customer', Poster: InsightPoster },
      { caption: 'Agent, just ask', Poster: AgentPoster },
      { caption: 'Closing, from usage to revenue', Poster: ClosingPoster },
    ],
  },
]
