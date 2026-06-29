import { CONFIG } from '@/utils/config'
import {
  ChangeDirection,
  Company,
  PricingModel,
  Product,
  RecentChange,
} from './types'

// Shape returned by the backend (snake_case). Kept local so the rest of the
// directory keeps using the camelCase Company/Product/PricePoint types.
interface ApiSnapshot {
  captured_at: string
  model: string
  anchor: string
  direction: ChangeDirection
}

interface ApiProduct {
  name: string
  current_model: string
  current_anchor: string
  last_direction: ChangeDirection
  last_change_at: string
  snapshots?: ApiSnapshot[]
}

interface ApiCompany {
  slug: string
  name: string
  category: string
  summary: string | null
  products: ApiProduct[]
}

const date = (iso: string) => iso.slice(0, 10)

function mapProduct(product: ApiProduct): Product {
  return {
    name: product.name,
    model: product.current_model as PricingModel,
    anchor: product.current_anchor,
    lastChange: date(product.last_change_at),
    direction: product.last_direction,
    history: (product.snapshots ?? []).map((snapshot) => ({
      date: date(snapshot.captured_at),
      value: snapshot.anchor,
      direction: snapshot.direction,
    })),
  }
}

function mapCompany(company: ApiCompany): Company {
  return {
    slug: company.slug,
    name: company.name,
    category: company.category,
    summary: company.summary ?? '',
    products: company.products.map(mapProduct),
  }
}

export async function fetchCompanies(): Promise<Company[]> {
  try {
    const response = await fetch(
      `${CONFIG.BASE_URL}/v1/pricing-directory/companies`,
      { next: { revalidate: 3600 } },
    )
    if (!response.ok) return []
    const companies: ApiCompany[] = await response.json()
    return companies.map(mapCompany)
  } catch {
    return []
  }
}

export async function fetchCompany(slug: string): Promise<Company | null> {
  try {
    const response = await fetch(
      `${CONFIG.BASE_URL}/v1/pricing-directory/companies/${slug}`,
      { next: { revalidate: 3600 } },
    )
    if (!response.ok) return null
    return mapCompany(await response.json())
  } catch {
    return null
  }
}

interface ApiChange {
  date: string
  company: string
  company_slug: string
  product: string
  model: string
  anchor: string
  direction: ChangeDirection
}

export async function fetchRecentChanges(): Promise<RecentChange[]> {
  try {
    const response = await fetch(
      `${CONFIG.BASE_URL}/v1/pricing-directory/changes`,
      { next: { revalidate: 3600 } },
    )
    if (!response.ok) return []
    const changes: ApiChange[] = await response.json()
    return changes.map((change) => ({
      date: date(change.date),
      company: change.company,
      companySlug: change.company_slug,
      product: change.product,
      model: change.model,
      anchor: change.anchor,
      direction: change.direction,
    }))
  } catch {
    return []
  }
}
