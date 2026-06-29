import { BrandFooter } from '@/components/Brand'
import {
  ChangesSection,
  DirectorySection,
  PricingDirectoryNav,
  PricingHero,
} from '@/components/PricingDirectory'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing Directory',
  description:
    'A living database of how companies price and how those prices change over time, to inspire your own pricing.',
}

export default function PricingDirectoryPage() {
  return (
    <div className="font-neue-montreal bg-brand-surface text-brand-muted min-h-screen antialiased">
      <PricingDirectoryNav />
      <main>
        <PricingHero />
        <DirectorySection />
        <ChangesSection />
      </main>
      <BrandFooter />
    </div>
  )
}
