import { getAllContent } from '@/utils/blog'
import { buildMetadata } from '@/utils/metadata'
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

  return buildMetadata({
    path: `/blog/${slug}`,
    title: post?.title,
    description: post?.description,
    type: 'article',
    ...(post?.image ? { image: post.image } : {}),
    ...(post?.date ? { publishedTime: post.date } : {}),
  })
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
