export const SELLING_CATEGORIES = [
  { name: 'Software / SaaS', prohibited: false },
  { name: 'Digital downloads', prohibited: false },
  { name: 'E-books or courses', prohibited: false },
  { name: 'Physical products', prohibited: true },
  { name: 'Services', prohibited: true },
  { name: 'Financial Trading', prohibited: true },
  { name: 'Advertising', prohibited: true },
  { name: 'Marketplace', prohibited: true },
  { name: 'Other', prohibited: false },
] as const

export const PRICING_MODELS = [
  'Subscription',
  'Seat-based subscription',
  'One-time purchase',
  'Usage-based',
] as const
