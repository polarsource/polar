'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { Article, Organization } from '@polar-sh/sdk'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms'

const ClientPage = ({
  organization,
  posts,
}: {
  organization: Organization
  posts: Article[]
}) => {
  return isFeatureEnabled('feed') ? (
    <StaggerReveal className="flex max-w-xl flex-col gap-y-6">
      {posts.map((post) => (
        <StaggerReveal.Child key={post.id}>
          <PostComponent article={post} />
        </StaggerReveal.Child>
      ))}
    </StaggerReveal>
  ) : (
    <ShadowBoxOnMd>
      <div className="flex flex-row items-start justify-between pb-8">
        <h2 className="text-lg font-medium">Issues looking for funding</h2>
      </div>
      <IssuesLookingForFunding organization={organization} />
    </ShadowBoxOnMd>
  )
}

export default ClientPage
