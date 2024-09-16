import { organizationPageLink } from '@/utils/nav'
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
      <h3 className="text-2xl font-medium">Newsletter</h3>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={organizationPageLink(organization, `posts/${post.slug}`)}
            className="flex h-full w-full flex-col transition-opacity hover:opacity-70"
          >
            <Post article={post} highlightPinned />
          </Link>
        ))}
      </div>
    </div>
  )
}
