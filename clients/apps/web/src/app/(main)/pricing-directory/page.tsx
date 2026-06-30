import { BrandFooter } from '@/components/Brand'
import {
  ChangesSection,
  DirectorySection,
  EditorialSection,
  PricingDirectoryNav,
} from '@/components/PricingDirectory'
import {
  fetchCompanies,
  fetchRecentChanges,
} from '@/components/PricingDirectory/api'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing Directory',
  description:
    'A living database of how companies price and how those prices change over time, to inspire your own pricing.',
}

export default async function PricingDirectoryPage() {
  const [companies, changes] = await Promise.all([
    fetchCompanies(),
    fetchRecentChanges(),
  ])

  return (
    <div className="font-neue-montreal bg-brand-surface text-brand-muted min-h-screen antialiased">
      <PricingDirectoryNav />
      <main>
        <DirectorySection companies={companies} />
        <ChangesSection changes={changes} />
        <EditorialSection />
      </main>
      <BrandFooter />
    </div>
  )
}
