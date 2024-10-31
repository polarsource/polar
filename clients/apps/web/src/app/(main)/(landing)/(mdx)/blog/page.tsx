import { firstImageUrlFromMarkdown } from '@/utils/markdown'
import Image from 'next/image'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { getBlogPosts } from './utils'

export default async function BlogPage() {
  const posts = await getBlogPosts()

  return (
    <div className="flex w-full flex-col gap-y-16">
      <h1 className="text-2xl md:text-5xl">Blog</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-12">
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
              className="group flex h-full flex-col"
              key={post.slug}
            >
              <Card className="flex h-full flex-col justify-between gap-y-6 overflow-hidden">
                <CardHeader className="p-6 pb-0">
                  {img ? (
                    <Image
                      className="aspect-video rounded-2xl object-cover"
                      src={img}
                      alt={post.metadata.title}
                      width={640}
                      height={360}
                    />
                  ) : (
                    <div className="dark:bg-polar-700 aspect-video rounded-2xl bg-gray-100" />
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-y-4 p-6 pt-0">
                  <h2 className="text-xl font-medium">{post.metadata.title}</h2>
                  <p className="dark:text-polar-500 line-clamp-2 text-gray-500">
                    {post.metadata.description}
                  </p>
                  <p className="dark:text-polar-500 text-gray-500">
                    {new Date(post.metadata.created_at).toLocaleDateString(
                      'en-US',
                      {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      },
                    )}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
