import { Company } from './types'

export type {
  ChangeDirection,
  Company,
  PricePoint,
  PricingModel,
  Product,
  RecentChange,
} from './types'

export const categories = [
  'All',
  'AI',
  'Infrastructure',
  'Developer Tools',
  'Data',
  'Productivity',
] as const

export const companyModels = (company: Company): string[] =>
  Array.from(new Set(company.products.map((product) => product.model)))

export const companyLatestChange = (company: Company): string => {
  const dates = company.products.map((product) => product.lastChange).sort()
  return dates[dates.length - 1]
}

export const stats = [
  { value: '240+', label: 'Companies tracked' },
  { value: '1,860', label: 'Pricing changes logged' },
  { value: '6', label: 'Categories' },
]
