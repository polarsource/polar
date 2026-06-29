import { ChangeDirection } from './data'

export interface PricePoint {
  date: string
  value: string
  direction: ChangeDirection
}

export interface CompanyDetail {
  summary: string
  history: PricePoint[]
}

// First-pass per-company detail, keyed by slug. The latest history point
// mirrors the directory entry; earlier points stand in for tracked changes.
export const companyDetails: Record<string, CompanyDetail> = {
  openai: {
    summary: 'Token pricing that keeps falling as models get cheaper to serve.',
    history: [
      { date: '2026-05-12', value: '$2.50 / M tokens', direction: 'down' },
      { date: '2025-12-01', value: '$3.00 / M tokens', direction: 'down' },
      { date: '2025-06-15', value: '$5.00 / M tokens', direction: 'new' },
    ],
  },
  anthropic: {
    summary:
      'Per-million-token pricing, softened further by cached-input discounts.',
    history: [
      { date: '2026-06-01', value: '$3.00 / M tokens', direction: 'down' },
      { date: '2025-10-10', value: '$3.75 / M tokens', direction: 'down' },
      { date: '2025-03-01', value: '$4.50 / M tokens', direction: 'new' },
    ],
  },
  vercel: {
    summary:
      'Moved from flat seats toward a seat-plus-usage hybrid as workloads grew.',
    history: [
      { date: '2026-04-20', value: '$20 / seat + usage', direction: 'up' },
      { date: '2025-09-01', value: '$20 / seat', direction: 'up' },
      { date: '2024-10-01', value: '$0 / hobby', direction: 'new' },
    ],
  },
  supabase: {
    summary: 'A free tier that funnels into a flat Pro plan, with usage on top.',
    history: [
      { date: '2026-03-15', value: '$25 / mo Pro', direction: 'up' },
      { date: '2024-12-01', value: '$25 / mo', direction: 'up' },
      { date: '2023-09-01', value: '$0 / free', direction: 'new' },
    ],
  },
  cursor: {
    summary: 'Seat pricing that recently gained a usage component for heavy users.',
    history: [
      { date: '2026-06-10', value: '$20 / user + usage', direction: 'new' },
      { date: '2025-08-01', value: '$20 / user / mo', direction: 'new' },
    ],
  },
  linear: {
    summary: 'Simple per-seat pricing, nudged up as the product expanded.',
    history: [
      { date: '2026-02-02', value: '$8 / user / mo', direction: 'up' },
      { date: '2023-10-01', value: '$6 / user / mo', direction: 'new' },
    ],
  },
  replicate: {
    summary: 'Per-second inference pricing that keeps dropping with efficiency.',
    history: [
      { date: '2026-05-28', value: '$0.0008 / sec', direction: 'down' },
      { date: '2025-07-01', value: '$0.0011 / sec', direction: 'down' },
      { date: '2024-08-01', value: '$0.0014 / sec', direction: 'new' },
    ],
  },
  modal: {
    summary: 'Granular GPU-second pricing, repriced down as capacity scales.',
    history: [
      { date: '2026-06-18', value: '$0.000038 / GPU-s', direction: 'down' },
      { date: '2025-11-01', value: '$0.000045 / GPU-s', direction: 'down' },
      { date: '2024-09-01', value: '$0.000052 / GPU-s', direction: 'new' },
    ],
  },
  notion: {
    summary: 'Per-seat pricing that has climbed across major releases.',
    history: [
      { date: '2026-01-22', value: '$10 / seat / mo', direction: 'up' },
      { date: '2023-05-01', value: '$8 / seat / mo', direction: 'up' },
      { date: '2021-09-01', value: '$4 / seat / mo', direction: 'new' },
    ],
  },
  render: {
    summary: 'Started free, now a flat monthly base with usage beyond it.',
    history: [
      { date: '2026-04-04', value: '$19 / mo', direction: 'up' },
      { date: '2023-07-01', value: '$7 / mo', direction: 'up' },
      { date: '2022-04-01', value: '$0 / free', direction: 'new' },
    ],
  },
  perplexity: {
    summary: 'A flat Pro subscription, newly introduced for power users.',
    history: [
      { date: '2026-05-05', value: '$20 / mo Pro', direction: 'new' },
    ],
  },
  planetscale: {
    summary: 'Shifted from flat plans to usage-based storage and reads.',
    history: [
      { date: '2026-03-28', value: '$0.024 / GB-mo', direction: 'up' },
      { date: '2024-04-08', value: '$39 / mo', direction: 'new' },
    ],
  },
}

export const getDetail = (slug: string): CompanyDetail | undefined =>
  companyDetails[slug]
