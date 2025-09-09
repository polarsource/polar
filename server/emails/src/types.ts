export interface OrganizationProps {
  name: string
  slug: string
  logo_url: string | null
  website_url: string | null
}

export interface BenefitProps {
  description: string
}

export interface ProductProps {
  name: string
  benefits: BenefitProps[]
}

export interface DiscountProps {
  name: string
  code: string | null
  type: 'fixed' | 'percentage'
  amount?: number
  basis_points?: number
  currency?: string
}

export interface PurchaseDetailsProps {
  amount: number
  currency: string
  recurring_interval: string | null
  discount: DiscountProps | null
  discounted_amount: number
  formatted_amount: string
  formatted_discounted_amount: string
  formatted_discount_amount: string | null
}
