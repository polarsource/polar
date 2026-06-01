export type InsightCategory =
  | 'revenue'
  | 'retention'
  | 'growth'
  | 'risk'
  | 'product'

export interface InsightAction {
  label: string
  href: string
}

export interface Insight {
  id: string
  category: InsightCategory
  /** Visible label next to the category dot. */
  categoryLabel: string
  title: string
  body: string
  /** Optional explanation surfaced via the "Why you're seeing this" link. */
  why?: string
  primaryAction?: InsightAction
  /** When true, render a "Not useful" button alongside Dismiss, so the user
   * can signal the insight was wrong. The pair (Dismiss / Not useful)
   * mirrors the mock and feeds two different signals back to the generator. */
  rejectable?: boolean
}
