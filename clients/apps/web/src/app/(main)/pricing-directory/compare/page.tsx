import { BrandFooter } from '@/components/Brand'
import {
  BrandContainer,
  Caption,
  Display,
  Lead,
} from '@/components/Brand/primitives'
import { PricingDirectoryNav } from '@/components/PricingDirectory'
import {
  fetchComparison,
  fetchFeatureCatalog,
  fetchFeatureGating,
} from '@/components/PricingDirectory/api'
import { ComparisonControls } from '@/components/PricingDirectory/ComparisonControls'
import { Option } from '@/components/PricingDirectory/compareOptions'
import { FeatureGating } from '@/components/PricingDirectory/FeatureGating'
import { PriceComparison } from '@/components/PricingDirectory/PriceComparison'
import { Metadata } from 'next'
import { ReactNode, Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Compare pricing',
  description:
    'Compare prices and features across providers in the pricing directory.',
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string
    unit?: string
    q?: string
    category?: string
    key?: string
  }>
}) {
  const sp = await searchParams
  const mode = sp.mode === 'features' ? 'features' : 'prices'

  const catalog = await fetchFeatureCatalog()
  const featureOptions: Option[] = catalog.map((feature) => ({
    value: feature.key,
    label: feature.label,
  }))

  let results: ReactNode
  if (mode === 'features') {
    const key = sp.key ?? catalog[0]?.key ?? 'sso'
    const featureLabel =
      catalog.find((feature) => feature.key === key)?.label ?? key
    const rows = await fetchFeatureGating(key)
    results = <FeatureGating rows={rows} featureLabel={featureLabel} />
  } else {
    const unit = sp.unit ?? (sp.q ? undefined : 'tokens')
    const rows = await fetchComparison({ unit, q: sp.q })
    results = <PriceComparison rows={rows} />
  }

  return (
    <div className="font-neue-montreal bg-brand-surface text-brand-muted min-h-screen antialiased">
      <PricingDirectoryNav />
      <main>
        <section className="bg-brand-raised pt-20 pb-16 md:pt-32 md:pb-24">
          <BrandContainer className="flex flex-col gap-8">
            <Caption>Compare</Caption>
            <Display className="max-w-[18ch]">Compare across providers</Display>
            <Lead className="max-w-2xl">
              Rank prices by any unit, or see which providers offer a feature.
              Every view is a shareable link.
            </Lead>
          </BrandContainer>
        </section>
        <section className="py-20 md:py-32">
          <BrandContainer className="flex flex-col gap-16">
            <Suspense>
              <ComparisonControls featureOptions={featureOptions} />
            </Suspense>
            {results}
          </BrandContainer>
        </section>
      </main>
      <BrandFooter />
    </div>
  )
}
