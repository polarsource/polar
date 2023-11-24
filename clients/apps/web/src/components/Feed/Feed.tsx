'use client'

import Link from 'next/link'
import { useListArticles } from 'polarkit/hooks'
import { StaggerReveal } from '../Shared/StaggerReveal'
import { Post as PostComponent } from './Posts/Post'

export const Feed = () => {
  const articles = useListArticles()

  if (!articles.data || !articles.data.items) {
    return <></>
  }

  return articles.data.items.length > 0 ? (
    <StaggerReveal className="flex flex-col gap-y-6">
      {articles.data.items.map((entity) => (
        <StaggerReveal.Child key={entity.id}>
          {/* {isRecommendation(entity) ? (
            <RecommendationComponent {...entity} />
          ) : ( */}
          <Link href={`/${entity.organization.name}/posts/${entity.slug}`}>
            <PostComponent article={entity} />
          </Link>
          {/* )} */}
        </StaggerReveal.Child>
      ))}
    </StaggerReveal>
  ) : null
}
