import { firstImageUrlFromMarkdown } from '@/utils/markdown'
import Image from 'next/image'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { CardFooter } from 'polarkit/components/ui/card'
import { getBlogPosts } from './utils'

export default async function BlogPage() {
  const posts = await getBlogPosts()

  return (
    <div className="flex w-full flex-col gap-y-16">
      <h1 className="text-2xl md:text-5xl">Blog</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">
        {posts.map((post) => {
          console.log(post.content)
          const firstImageUrl = firstImageUrlFromMarkdown(post.content)

          return (
            <Link
              href={`/blog/${post.slug}`}
              className="group flex h-full flex-col"
              key={post.slug}
            >
              <Card className="flex h-full flex-col justify-between">
                <CardHeader>
                  <Image
                    className="aspect-video object-cover"
                    src={firstImageUrl ?? ''}
                    alt={post.metadata.title}
                    width={640}
                    height={360}
                  />
                </CardHeader>
                <CardContent className="flex flex-col gap-y-4">
                  <h2 className="text-xl font-medium">{post.metadata.title}</h2>
                  <p className="dark:text-polar-500 line-clamp-2 text-gray-500">
                    {post.metadata.description}
                  </p>
                </CardContent>
                <CardFooter>
                  <p className="dark:text-polar-500 text-gray-500">
                    {new Date(post.metadata.created_at).toLocaleDateString(
                      'en-US',
                      {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      },
                    )}
                  </p>
                </CardFooter>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
