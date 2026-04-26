import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFeature, getAllSlugs } from '../../components/features/featureData'
import { FeaturePageLayout } from '../../components/features/FeaturePageLayout'

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const feature = getFeature(slug)
  if (!feature) return {}
  return {
    title: `${feature.title} — Polar`,
    description: feature.subtitle,
  }
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const feature = getFeature(slug)
  if (!feature) notFound()
  return <FeaturePageLayout feature={feature} />
}
