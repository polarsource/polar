'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { Article } from '@polar-sh/sdk'

const ClientPage = ({ posts }: { posts: Article[] }) => {
  return (
    isFeatureEnabled('feed') && (
      <StaggerReveal className="flex max-w-xl flex-col gap-y-6">
        {posts.map((post) => (
          <StaggerReveal.Child key={post.id}>
            <PostComponent article={post} />
          </StaggerReveal.Child>
        ))}
      </StaggerReveal>
    )
  )
}

export default ClientPage
