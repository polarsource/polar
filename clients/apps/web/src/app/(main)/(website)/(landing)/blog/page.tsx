import { BlogHero } from '@/components/Blog/BlogHero'
import { StaticImage } from '@/components/Image/StaticImage'
import Footer from '@/components/Organization/Footer'
import { getAllContent } from '@/utils/blog'
import Link from 'next/link'

function formatDate(dateStr: string) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const TYPE_LABEL: Record<string, string> = {
  blog: 'Blog',
  story: 'Customer Story',
}

export default function BlogPage() {
  const posts = getAllContent()

  return (
    <div className="dark:bg-polar-950 min-h-screen bg-white text-gray-900 dark:text-white">
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-12">
        <BlogHero
          title="Blog"
          description="Building in the open — payments, developer tools, and lessons from the road."
        />
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 pb-24">
        <div className="grid gap-12 md:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={`${post.type}-${post.slug}`}
              href={post.href}
              className="group flex flex-col gap-4"
            >
              <div className="dark:bg-polar-800 relative aspect-video w-full overflow-hidden rounded-md bg-gray-100">
                {post.image ? (
                  <StaticImage
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                  />
                ) : (
                  <div className="dark:bg-polar-800 absolute inset-0 bg-gray-100" />
                )}
              </div>

              <div className="flex flex-col gap-4">
                <h2 className="text-lg leading-snug font-medium transition-opacity group-hover:opacity-70">
                  {post.title}
                </h2>
                <div className="dark:text-polar-500 flex items-center gap-2 text-sm text-gray-400">
                  <span className="font-medium">{TYPE_LABEL[post.type]}</span>
                  {post.date && (
                    <>
                      <span>·</span>
                      <span>{formatDate(post.date)}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
