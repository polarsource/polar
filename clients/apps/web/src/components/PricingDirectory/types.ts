export type PricingModel = 'Usage' | 'Seat' | 'Tiered' | 'Hybrid' | 'Flat'
export type ChangeDirection = 'up' | 'down' | 'new'

export interface PricePoint {
  date: string
  value: string
  direction: ChangeDirection
}

export interface ProductMetric {
  label: string
  unit: string
  amount: number
  perQuantity: number
  currency: string
}

export interface ProductFeature {
  name: string
  key: string
  category: string
  value: string | null
}

export interface Product {
  name: string
  model: PricingModel
  anchor: string
  lastChange: string
  direction: ChangeDirection
  history: PricePoint[]
  metrics: ProductMetric[]
  features: ProductFeature[]
}

export interface Company {
  slug: string
  name: string
  category: string
  summary: string
  products: Product[]
}

export interface RecentChange {
  date: string
  company: string
  companySlug: string
  product: string
  model: string
  anchor: string
  direction: ChangeDirection
}

export interface ComparisonRow {
  company: string
  companySlug: string
  product: string
  label: string
  unit: string
  amount: number
  perQuantity: number
  currency: string
  unitPrice: number
}

export interface GatingRow {
  company: string
  companySlug: string
  plan: string
  anchor: string
  value: string | null
}

export interface CatalogFeature {
  key: string
  label: string
  category: string
}
