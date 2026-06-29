// First-pass sample data for the pricing directory. This stands in for the
// live database of companies and their pricing changes over time.

export type PricingModel = 'Usage' | 'Seat' | 'Tiered' | 'Hybrid' | 'Flat'
export type ChangeDirection = 'up' | 'down' | 'new'

export interface PricingEntry {
  company: string
  category: string
  model: PricingModel
  anchor: string
  lastChange: string
  direction: ChangeDirection
  changes: number
}

export const categories = [
  'All',
  'AI',
  'Infrastructure',
  'Developer Tools',
  'Data',
  'Productivity',
] as const

export const entries: PricingEntry[] = [
  {
    company: 'OpenAI',
    category: 'AI',
    model: 'Usage',
    anchor: '$2.50 / M tokens',
    lastChange: '2026-05-12',
    direction: 'down',
    changes: 9,
  },
  {
    company: 'Anthropic',
    category: 'AI',
    model: 'Usage',
    anchor: '$3.00 / M tokens',
    lastChange: '2026-06-01',
    direction: 'down',
    changes: 7,
  },
  {
    company: 'Vercel',
    category: 'Infrastructure',
    model: 'Hybrid',
    anchor: '$20 / seat + usage',
    lastChange: '2026-04-20',
    direction: 'up',
    changes: 12,
  },
  {
    company: 'Supabase',
    category: 'Data',
    model: 'Tiered',
    anchor: '$25 / mo Pro',
    lastChange: '2026-03-15',
    direction: 'up',
    changes: 6,
  },
  {
    company: 'Cursor',
    category: 'Developer Tools',
    model: 'Seat',
    anchor: '$20 / user / mo',
    lastChange: '2026-06-10',
    direction: 'new',
    changes: 4,
  },
  {
    company: 'Linear',
    category: 'Productivity',
    model: 'Seat',
    anchor: '$8 / user / mo',
    lastChange: '2026-02-02',
    direction: 'up',
    changes: 5,
  },
  {
    company: 'Replicate',
    category: 'AI',
    model: 'Usage',
    anchor: '$0.0008 / sec',
    lastChange: '2026-05-28',
    direction: 'down',
    changes: 8,
  },
  {
    company: 'Modal',
    category: 'Infrastructure',
    model: 'Usage',
    anchor: '$0.000038 / GPU-s',
    lastChange: '2026-06-18',
    direction: 'down',
    changes: 5,
  },
  {
    company: 'Notion',
    category: 'Productivity',
    model: 'Seat',
    anchor: '$10 / seat / mo',
    lastChange: '2026-01-22',
    direction: 'up',
    changes: 6,
  },
  {
    company: 'Render',
    category: 'Infrastructure',
    model: 'Tiered',
    anchor: '$19 / mo',
    lastChange: '2026-04-04',
    direction: 'up',
    changes: 4,
  },
  {
    company: 'Perplexity',
    category: 'AI',
    model: 'Tiered',
    anchor: '$20 / mo Pro',
    lastChange: '2026-05-05',
    direction: 'new',
    changes: 2,
  },
  {
    company: 'PlanetScale',
    category: 'Data',
    model: 'Usage',
    anchor: '$0.024 / GB-mo',
    lastChange: '2026-03-28',
    direction: 'up',
    changes: 7,
  },
]

export const slugify = (company: string) =>
  company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export const getEntryBySlug = (slug: string): PricingEntry | undefined =>
  entries.find((entry) => slugify(entry.company) === slug)

export const stats = [
  { value: '240+', label: 'Companies tracked' },
  { value: '1,860', label: 'Pricing changes logged' },
  { value: '6', label: 'Categories' },
  { value: 'Weekly', label: 'Refresh cadence' },
]

export interface PricingChange {
  date: string
  company: string
  summary: string
  direction: ChangeDirection
}

export const recentChanges: PricingChange[] = [
  {
    date: '2026-06-18',
    company: 'Modal',
    summary: 'Cut GPU-second pricing by 15% across all instance types.',
    direction: 'down',
  },
  {
    date: '2026-06-10',
    company: 'Cursor',
    summary: 'Introduced a usage-based Pro tier alongside the flat seat price.',
    direction: 'new',
  },
  {
    date: '2026-06-01',
    company: 'Anthropic',
    summary: 'Lowered input token pricing and added cached-input discounts.',
    direction: 'down',
  },
  {
    date: '2026-05-12',
    company: 'OpenAI',
    summary: 'Shifted to per-million-token pricing with cheaper cached reads.',
    direction: 'down',
  },
  {
    date: '2026-04-20',
    company: 'Vercel',
    summary: 'Raised the included usage allowance and the per-seat base price.',
    direction: 'up',
  },
]
