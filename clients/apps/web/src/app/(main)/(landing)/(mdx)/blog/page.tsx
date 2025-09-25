import { firstImageUrlFromMarkdown } from '@/utils/markdown'
import Image from 'next/image'
import Link from 'next/link'
import { getBlogPosts } from './utils'

export default async function BlogPage() {
  const posts = await getBlogPosts()

  return (
    <div className="not-prose flex w-full flex-col gap-y-8 md:gap-y-16">
      <h1 className="text-3xl md:text-5xl">Blog</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
        {posts.map(async (post) => {
          const firstImageUrl = firstImageUrlFromMarkdown(
            post.content,
          )?.replace(/^\.\/?/, '')

          const img = firstImageUrl
            ? await import(`./(header)/${post.slug}/${firstImageUrl}`)
            : undefined

          return (
            <Link
              href={`/blog/${post.slug}`}
              className="group flex h-full flex-col gap-y-4"
              key={post.slug}
            >
              {img ? (
                <Image
                  className="aspect-square rounded-md object-cover"
                  src={img}
                  alt={post.metadata.title}
                  width={640}
                  height={360}
                />
              ) : (
                <div className="dark:bg-polar-700 aspect-square rounded-md bg-gray-100" />
              )}
              <div className="flex flex-col gap-y-2">
                <h2 className="text-lg">{post.metadata.title}</h2>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  {new Date(post.metadata.created_at).toLocaleDateString(
                    'en-US',
                    {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    },
                  )}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
