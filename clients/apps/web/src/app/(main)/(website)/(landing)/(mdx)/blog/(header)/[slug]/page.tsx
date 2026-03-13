import { getAllContent } from '@/utils/blog'
import fs from 'fs'
import type { Metadata } from 'next'
import path from 'path'

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif']

const POSTS_DIR = path.join(
  process.cwd(),
  'src/app/(main)/(website)/(landing)/(mdx)/blog/(header)/_posts',
)

function findCoverImage(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir).sort()
    const img = files.find((f) =>
      IMAGE_EXTS.includes(path.extname(f).toLowerCase()),
    )
    return img ?? null
  } catch {
    return null
  }
}

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
  const imageFile = findCoverImage(path.join(POSTS_DIR, slug))
  const imageUrl = imageFile
    ? `/api/cover?type=blog&slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(imageFile)}`
    : undefined

  return {
    title: post?.title,
    description: post?.description,
    ...(post?.date && { publishedTime: post.date }),
    openGraph: {
      title: post?.title,
      description: post?.description,
      ...(post?.date && { publishedTime: post.date }),
      ...(imageUrl && { images: [imageUrl] }),
    },
    twitter: {
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
