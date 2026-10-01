export const AI_IMAGE_VIDEO_GENERATION_CATEGORY = 'AI image or video generation'

export const SELLING_CATEGORIES = [
  { name: 'Software / SaaS', prohibited: false },
  { name: 'Digital downloads', prohibited: false },
  { name: 'E-books or courses', prohibited: false },
  { name: AI_IMAGE_VIDEO_GENERATION_CATEGORY, prohibited: false },
  { name: 'Physical products', prohibited: true },
  { name: 'Services', prohibited: true },
  { name: 'Financial Trading', prohibited: true },
  { name: 'Advertising', prohibited: true },
  { name: 'Marketplace', prohibited: true },
  { name: 'Other', prohibited: false },
] as const

// Restricted businesses held to strict review: a business email on the
// organization's own domain and an API + webhook integration are required.
// Mirrors `polar.organization_review.strict_category` on the server.
const STRICT_SELLING_CATEGORIES: ReadonlySet<string> = new Set([
  AI_IMAGE_VIDEO_GENERATION_CATEGORY,
])

export const isStrictCategory = (
  sellingCategories: readonly string[] | null | undefined,
): boolean =>
  (sellingCategories ?? []).some((c) => STRICT_SELLING_CATEGORIES.has(c))

export const PRICING_MODELS = [
  'Subscription',
  'Seat-based subscription',
  'One-time purchase',
  'Usage-based',
] as const
