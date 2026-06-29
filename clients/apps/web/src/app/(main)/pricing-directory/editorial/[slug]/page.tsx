import { BrandFooter } from '@/components/Brand'
import {
  ArticleDetail,
  PricingDirectoryNav,
} from '@/components/PricingDirectory'
import { articles, getArticleBySlug } from '@/components/PricingDirectory/editorial'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const dynamicParams = false

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return {}
  return { title: article.title, description: article.dek }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  return (
    <div className="font-neue-montreal bg-brand-surface text-brand-muted min-h-screen antialiased">
      <PricingDirectoryNav />
      <main>
        <ArticleDetail article={article} />
      </main>
      <BrandFooter />
    </div>
  )
}
