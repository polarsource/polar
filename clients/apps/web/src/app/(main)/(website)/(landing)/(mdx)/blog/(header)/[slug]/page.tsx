import { getAllContent } from '@/utils/blog'
import type { Metadata } from 'next'

export const dynamic = 'force-static'
export const dynamicParams = false

export async function generateStaticParams() {
  const posts = getAllContent()
  return posts.filter((p) => p.type === 'blog').map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getAllContent().find((p) => p.slug === slug)
  const imageUrl = post?.image ?? undefined

  return {
    title: post?.title,
    description: post?.description,
    ...(post?.date && { publishedTime: post.date }),
    openGraph: {
      type: 'article',
      title: post?.title,
      description: post?.description,
      ...(post?.date && { publishedTime: post.date }),
      ...(imageUrl && { images: [imageUrl] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post?.title,
      description: post?.description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  }
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { default: Post } = await import(`../_posts/${slug}/page.mdx`)
  return <Post />
}
