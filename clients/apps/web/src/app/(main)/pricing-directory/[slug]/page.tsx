import { BrandFooter } from '@/components/Brand'
import {
  CompanyDetail,
  PricingDirectoryNav,
} from '@/components/PricingDirectory'
import { getDetail } from '@/components/PricingDirectory/companyDetails'
import {
  entries,
  getEntryBySlug,
  slugify,
} from '@/components/PricingDirectory/data'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const dynamicParams = false

export function generateStaticParams() {
  return entries.map((entry) => ({ slug: slugify(entry.company) }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const entry = getEntryBySlug(slug)
  if (!entry) return {}
  return {
    title: `${entry.company} pricing`,
    description: `How ${entry.company} prices, and how it has changed over time.`,
  }
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const entry = getEntryBySlug(slug)
  const detail = getDetail(slug)

  if (!entry || !detail) {
    notFound()
  }

  return (
    <div className="font-neue-montreal bg-brand-surface text-brand-muted min-h-screen antialiased">
      <PricingDirectoryNav />
      <main>
        <CompanyDetail entry={entry} detail={detail} />
      </main>
      <BrandFooter />
    </div>
  )
}
