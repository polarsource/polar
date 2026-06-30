import { BrandFooter } from '@/components/Brand'
import {
  PricingDirectoryNav,
  ProductDetail,
} from '@/components/PricingDirectory'
import { fetchCompany } from '@/components/PricingDirectory/api'
import { productSlug } from '@/components/PricingDirectory/data'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

async function resolve(slug: string, productParam: string) {
  const company = await fetchCompany(slug)
  if (!company) return null
  const product = company.products.find(
    (candidate) => productSlug(candidate.name) === productParam,
  )
  if (!product) return null
  return { company, product }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; product: string }>
}): Promise<Metadata> {
  const { slug, product: productParam } = await params
  const resolved = await resolve(slug, productParam)
  if (!resolved) return {}
  const { company, product } = resolved
  return {
    title: `${company.name} ${product.name} pricing`,
    description: `How ${company.name} prices ${product.name}, and how that price has changed over time.`,
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; product: string }>
}) {
  const { slug, product: productParam } = await params
  const resolved = await resolve(slug, productParam)

  if (!resolved) {
    notFound()
  }

  return (
    <div className="font-neue-montreal bg-brand-surface text-brand-muted min-h-screen antialiased">
      <PricingDirectoryNav />
      <main>
        <ProductDetail company={resolved.company} product={resolved.product} />
      </main>
      <BrandFooter />
    </div>
  )
}
