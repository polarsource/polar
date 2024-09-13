import { organizationPageLink } from '@/utils/nav'
import { ArrowForward } from '@mui/icons-material'
import { Article, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { Post } from '../Feed/Posts/Post'

export interface NewsletterFeedProps {
  organization: Organization
  posts: Article[]
}

export const NewsletterFeed = ({
  organization,
  posts,
}: NewsletterFeedProps) => {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl">Newsletters</h3>
        <Link
          className="dark:text-polar-500 flex flex-row items-center gap-2 text-sm text-blue-500 transition-colors hover:text-blue-400 dark:hover:text-white"
          href={organizationPageLink(organization, 'posts')}
        >
          <span>View all</span>
          <ArrowForward fontSize="inherit" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={organizationPageLink(organization, `posts/${post.slug}`)}
            className="flex h-full w-full flex-col gap-1 py-6 transition-opacity hover:opacity-70"
          >
            <Post article={post} highlightPinned />
          </Link>
        ))}
      </div>
    </div>
  )
}
