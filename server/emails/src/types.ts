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
  purchase_email_note: string | null
}
