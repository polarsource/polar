import { fetchCompanies } from '@/components/PricingDirectory/api'
import { PricingAdvisor } from '@/components/PricingDirectory/PricingAdvisor'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Find your pricing',
  description:
    'Answer a few questions and get a pricing approach that fits what you are building.',
}

export default async function AdvisorPage() {
  const companies = await fetchCompanies()

  return (
    <div className="font-neue-montreal bg-brand-surface text-brand-muted min-h-screen antialiased">
      <PricingAdvisor companies={companies} />
    </div>
  )
}
