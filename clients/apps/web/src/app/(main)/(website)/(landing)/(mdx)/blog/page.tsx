import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import { Metadata } from 'next'
import Link from 'next/link'

const posts = [
  {
    title: 'Announcing our $10M Seed Round',
    slug: 'polar-seed-announcement',
    description:
      "We're thrilled to announce our $10M Seed round led by Accel, with continued support from Abstract & Mischief, alongside an exceptional group of angels",
    date: '2025-06-17',
  },
  {
    title: 'Mitchell Hashimoto joins Polar as an advisor',
    slug: 'mitchell-hashimoto-joins-polar-as-an-advisor',
    description:
      "Today, we're honoured to announce that Mitchell Hashimoto is joining Polar as an advisor!",
    date: '2024-04-02',
  },
]

export const metadata: Metadata = {
  title: 'Blog',
  openGraph: {
    siteName: 'Polar',
    type: 'website',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
        alt: 'Polar',
      },
    ],
  },
}

export default function BlogIndex() {
  return (
    <div className="flex min-h-screen flex-col">
      <main>
        <div className="mx-auto flex w-full max-w-6xl flex-col px-2 md:px-0">
          <div className="dark:md:bg-polar-900 dark:border-polar-700 flex flex-col gap-y-8 rounded-lg border-gray-200 shadow-xs md:gap-y-12 md:border md:bg-white md:p-24 md:px-16">
            <div className="flex flex-col">
              <div className="flex flex-col gap-y-8 lg:items-center">
                <h1 className="lg:text-center">Blog</h1>
              </div>
            </div>
            <div className="dark:border-polar-700 flex flex-col border-t border-gray-200">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="dark:border-polar-700 dark:hover:bg-polar-800 group flex flex-col gap-3 border-b border-gray-200 p-4 transition-colors duration-200 last:border-b-0 hover:bg-gray-50 md:p-6"
                >
                  <div className="flex items-center justify-between">
                    <time className="dark:text-polar-500 text-sm text-gray-500">
                      {new Date(post.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                    <ArrowForwardOutlined
                      fontSize="small"
                      className="dark:text-polar-500 dark:group-hover:text-polar-300 text-gray-400 transition-colors group-hover:text-gray-600"
                    />
                  </div>
                  <h2 className="text-xl md:text-2xl">{post.title}</h2>
                  <p className="dark:text-polar-400 leading-relaxed text-gray-600">
                    {post.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
